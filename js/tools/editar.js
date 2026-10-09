/* Editor visual: texto, firma, imágenes, formas, resaltador, tapar y dibujo libre.
   Los objetos se guardan en "unidades de página" (puntos de la vista a escala 1,
   origen arriba-izquierda) y se convierten a coordenadas PDF al guardar. */
(function () {
    const { degrees, StandardFonts, BlendMode, LineCapStyle } = PDFLib;

    const FONTS = {
        helv: { label: 'Helvetica', css: 'Helvetica, Arial, sans-serif', base: 0.947, std: { n: 'Helvetica', b: 'HelveticaBold', i: 'HelveticaOblique', bi: 'HelveticaBoldOblique' } },
        times: { label: 'Times', css: "'Times New Roman', Times, serif", base: 0.9375, std: { n: 'TimesRoman', b: 'TimesRomanBold', i: 'TimesRomanItalic', bi: 'TimesRomanBoldItalic' } },
        courier: { label: 'Courier', css: "'Courier New', Courier, monospace", base: 0.866, std: { n: 'Courier', b: 'CourierBold', i: 'CourierOblique', bi: 'CourierBoldOblique' } },
    };
    const LINE_H = 1.2;
    const PALETTE = ['#111111', '#ffffff', '#e5484d', '#f76b15', '#ffe14d', '#2f9e5b', '#1b4fd8', '#8e4ec6'];
    const HL_PALETTE = ['#ffe14d', '#7ee787', '#7cc4ff', '#ff9ecf', '#ffb35c'];

    const TOOLS = [
        { id: 'select', label: 'Mover', icon: 'cursor' },
        { id: 'text', label: 'Texto', icon: 'text' },
        { id: 'signature', label: 'Firma', icon: 'signature', action: true },
        { id: 'image', label: 'Imagen', icon: 'image', action: true },
        { sep: true },
        { id: 'highlight', label: 'Resaltar', icon: 'highlighter' },
        { id: 'draw', label: 'Dibujar', icon: 'pencil' },
        { id: 'rect', label: 'Rectángulo', icon: 'square' },
        { id: 'ellipse', label: 'Círculo', icon: 'circle' },
        { id: 'line', label: 'Línea', icon: 'line' },
        { id: 'whiteout', label: 'Tapar', icon: 'eraser' },
        { sep: true },
        { id: 'check', label: 'Marca ✓', icon: 'check', action: true },
        { id: 'cross', label: 'Marca ✗', icon: 'x', action: true },
        { id: 'date', label: 'Fecha', icon: 'calendar', action: true },
    ];

    const HELP = {
        select: 'Haz clic en un elemento para seleccionarlo. Arrástralo para moverlo y usa las esquinas para cambiar su tamaño. Doble clic en un texto para editarlo.',
        text: 'Haz clic en cualquier lugar de la página para escribir.',
        highlight: 'Arrastra sobre la zona que quieres resaltar.',
        draw: 'Dibuja a mano alzada sobre la página.',
        rect: 'Arrastra para dibujar un rectángulo.',
        ellipse: 'Arrastra para dibujar un círculo u óvalo.',
        line: 'Arrastra para dibujar una línea.',
        whiteout: 'Arrastra para cubrir una zona con un recuadro (por defecto blanco). Ojo: tapa visualmente, pero el texto original sigue existiendo debajo.',
    };

    Tools.register({
        id: 'editar',
        name: 'Editar y firmar',
        desc: 'Añade texto, firmas, imágenes, resaltados, formas y dibujos.',
        icon: 'edit',
        color: '#8e4ec6',
        section: 'editar',
        mount(ctx) {
            let file = null;
            let infos = []; // por página: { vp, page, el, layer, rendered }
            let objects = [];
            let selectedId = null;
            let mode = 'select';
            let zoom = 1;
            let currentPage = 0;
            let objSeq = 0;
            const history = [];
            const defaults = {
                text: { font: 'helv', size: 16, color: '#111111', bold: false, italic: false },
                rect: { stroke: '#e5484d', fill: '', width: 2, opacity: 1 },
                ellipse: { stroke: '#e5484d', fill: '', width: 2, opacity: 1 },
                line: { stroke: '#e5484d', width: 3, opacity: 1 },
                draw: { stroke: '#1b4fd8', width: 3, opacity: 1 },
                highlight: { fill: '#ffe14d', opacity: 0.45 },
                whiteout: { fill: '#ffffff' },
                image: { opacity: 1 },
            };
            let els = {}; // referencias DOM del editor
            let signatures = []; // firmas creadas en esta sesión (solo en memoria)

            const snapshot = () => { history.push(JSON.stringify(objects)); if (history.length > 80) history.shift(); };
            const undo = () => {
                if (!history.length) return UI.toast('Nada que deshacer', 'info');
                objects = JSON.parse(history.pop());
                selectedId = null;
                renderAllObjects();
                renderProps();
            };
            const markDirty = () => { Tools.dirty = objects.length > 0; };
            ctx.onCleanup(() => { Tools.dirty = false; });

            /* ================= Carga ================= */
            const load = async (list) => {
                const [f] = await Engine.loadMany(list.slice(0, 1));
                if (!f) return;
                await UI.task('Preparando editor…', async () => {
                    file = f;
                    objects = [];
                    history.length = 0;
                    selectedId = null;
                    const doc = await Engine.pdfjsDoc(f);
                    infos = [];
                    for (let i = 0; i < f.pageCount; i++) {
                        const page = await doc.getPage(i + 1);
                        infos.push({ page, vp: page.getViewport({ scale: 1 }), rendered: 0 });
                    }
                    buildEditor();
                });
            };

            /* ================= Estructura ================= */
            const buildEditor = () => {
                ctx.sideWrap.hidden = false;
                ctx.body.style.padding = '0';
                const ed = UI.el(`<div class="editor">
                    <div class="editor-pages"></div>
                    <div class="editor-stage-wrap">
                        <div class="editor-toolbar"></div>
                        <div class="editor-scroll"><div class="editor-pagestack"></div></div>
                    </div>
                </div>`);
                els = {
                    ed,
                    thumbs: ed.querySelector('.editor-pages'),
                    toolbar: ed.querySelector('.editor-toolbar'),
                    scroll: ed.querySelector('.editor-scroll'),
                    stack: ed.querySelector('.editor-pagestack'),
                };
                // Barra de herramientas
                TOOLS.forEach((t) => {
                    if (t.sep) { els.toolbar.appendChild(UI.el('<span class="sep"></span>')); return; }
                    const b = UI.el(`<button type="button" class="tool-btn" data-tool="${t.id}" aria-pressed="${t.id === mode}" title="${t.label}">${icon(t.icon)}<span>${t.label}</span></button>`);
                    b.addEventListener('click', () => onToolClick(t));
                    els.toolbar.appendChild(b);
                });
                els.toolbar.appendChild(UI.el('<span class="sep"></span>'));
                const z = UI.el(`<div class="zoom-ctl">
                    <button class="btn btn-sm btn-icon btn-ghost" data-z="-" title="Alejar">${icon('zoomOut')}</button>
                    <span data-zl></span>
                    <button class="btn btn-sm btn-icon btn-ghost" data-z="+" title="Acercar">${icon('zoomIn')}</button>
                    <button class="btn btn-sm btn-ghost" data-z="fit" title="Ajustar al ancho">${icon('fit')}</button>
                    <button class="btn btn-sm btn-ghost" data-undo title="Deshacer (Ctrl+Z)">${icon('undo')}</button>
                </div>`);
                z.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => {
                    const v = b.dataset.z;
                    setZoom(v === 'fit' ? fitZoom() : v === '+' ? zoom * 1.2 : zoom / 1.2);
                }));
                z.querySelector('[data-undo]').addEventListener('click', undo);
                els.toolbar.appendChild(z);
                els.zoomLabel = z.querySelector('[data-zl]');

                // Miniaturas laterales
                infos.forEach((info, i) => {
                    const t = UI.el(`<div class="page-item" data-thumb="${i}"><div class="thumb-wrap"></div><div class="page-label">${i + 1}</div></div>`);
                    t.querySelector('.thumb-wrap').appendChild(Engine.lazyThumb(file, i, 130));
                    t.addEventListener('click', () => scrollToPage(i));
                    els.thumbs.appendChild(t);
                });

                // Páginas
                infos.forEach((info, i) => {
                    const p = UI.el(`<div class="ed-page" data-page="${i}"><span class="ed-pagenum">Página ${i + 1}</span><div class="ed-layer"></div></div>`);
                    info.el = p;
                    info.layer = p.querySelector('.ed-layer');
                    bindLayer(info.layer, i);
                    els.stack.appendChild(p);
                });

                ctx.body.replaceChildren(ed);
                // Renderiza solo las páginas visibles
                pageObserver?.disconnect();
                pageObserver = new IntersectionObserver((entries) => {
                    entries.forEach((en) => {
                        const i = +en.target.dataset.page;
                        infos[i].visible = en.isIntersecting;
                        if (en.isIntersecting) renderPage(i);
                    });
                    const vis = infos.map((x, i) => (x.visible ? i : -1)).filter((i) => i >= 0);
                    if (vis.length) setCurrentPage(vis[0]);
                }, { root: els.scroll, rootMargin: '300px 0px' });
                infos.forEach((info) => pageObserver.observe(info.el));
                setZoom(fitZoom());
                setMode('select');
                renderProps();
                renderFooter();
            };
            let pageObserver = null;
            ctx.onCleanup(() => pageObserver?.disconnect());

            const fitZoom = () => {
                const maxW = Math.max(...infos.map((i) => i.vp.width));
                const avail = (els.scroll.clientWidth || 800) - 60;
                return Math.max(0.3, Math.min(2.5, avail / maxW));
            };

            const setZoom = (z) => {
                zoom = Math.max(0.25, Math.min(4, z));
                els.zoomLabel.textContent = Math.round(zoom * 100) + '%';
                infos.forEach((info, i) => {
                    info.el.style.width = info.vp.width * zoom + 'px';
                    info.el.style.height = info.vp.height * zoom + 'px';
                    if (info.visible) renderPage(i);
                });
                renderAllObjects();
            };

            const renderPage = async (i) => {
                const info = infos[i];
                if (info.rendered === zoom || info.rendering === zoom) return;
                info.rendering = zoom;
                const z = zoom;
                const dpr = Math.min(devicePixelRatio || 1, 2);
                const c = document.createElement('canvas');
                c.className = 'ed-canvas';
                const vp = info.page.getViewport({ scale: z * dpr });
                c.width = Math.floor(vp.width);
                c.height = Math.floor(vp.height);
                try {
                    await info.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                } catch (e) { console.error(e); info.rendering = 0; return; }
                if (z !== zoom) { info.rendering = 0; if (info.visible) renderPage(i); return; }
                info.el.querySelector('canvas.ed-canvas')?.remove();
                info.el.insertBefore(c, info.layer);
                info.rendered = z;
                info.rendering = 0;
            };

            const setCurrentPage = (i) => {
                currentPage = i;
                els.thumbs.querySelectorAll('[data-thumb]').forEach((t) => t.classList.toggle('selected', +t.dataset.thumb === i));
            };
            const scrollToPage = (i) => {
                els.scroll.scrollTo({ top: infos[i].el.offsetTop - 30, behavior: 'smooth' });
                setCurrentPage(i);
            };

            /* ================= Herramientas ================= */
            const setMode = (m) => {
                mode = m;
                els.toolbar.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === m)));
                infos.forEach((info) => {
                    info.layer.className = 'ed-layer mode-' + m;
                    info.layer.style.touchAction = m === 'select' ? '' : 'none';
                });
                if (m !== 'select') select(null);
                renderProps();
            };

            const onToolClick = (t) => {
                if (!t.action) return setMode(t.id);
                if (t.id === 'signature') return openSignature();
                if (t.id === 'image') return pickImage();
                if (t.id === 'date') {
                    const d = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return placeCentered({ kind: 'text', text: d, ...defaults.text }, 0, 0, true);
                }
                if (t.id === 'check' || t.id === 'cross') {
                    const strokes = t.id === 'check'
                        ? [[[0, 0.55], [0.36, 0.95], [1, 0.05]]]
                        : [[[0, 0], [1, 1]], [[1, 0], [0, 1]]];
                    return placeCentered({ kind: 'draw', strokes, stroke: t.id === 'check' ? '#2f9e5b' : '#e5484d', width: 3, opacity: 1 }, 24, 24);
                }
            };

            /** Coloca un objeto en el centro de la página visible */
            const placeCentered = (obj, w, h, measure) => {
                const vp = infos[currentPage].vp;
                snapshot();
                const o = { id: ++objSeq, page: currentPage, x: (vp.width - w) / 2, y: (vp.height - h) / 2, w, h, ...obj };
                objects.push(o);
                renderObjects(currentPage);
                if (measure) { measureText(o); o.x = (vp.width - o.w) / 2; o.y = (vp.height - o.h) / 2; renderObjects(currentPage); }
                setMode('select');
                select(o.id);
                markDirty();
                return o;
            };

            /* ================= Interacción en la página ================= */
            const toBase = (layer, e) => {
                const r = layer.getBoundingClientRect();
                return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
            };

            const bindLayer = (layer, pageIdx) => {
                layer.addEventListener('pointerdown', (e) => {
                    if (e.button !== 0 || e.target !== layer) return;
                    setCurrentPage(pageIdx);
                    if (mode === 'select') { select(null); return; }
                    e.preventDefault();
                    const p0 = toBase(layer, e);
                    const vp = infos[pageIdx].vp;
                    if (mode === 'text') {
                        snapshot();
                        const o = { id: ++objSeq, page: pageIdx, kind: 'text', text: '', x: p0.x, y: p0.y - defaults.text.size * LINE_H / 2, w: 10, h: 10, ...defaults.text };
                        objects.push(o);
                        renderObjects(pageIdx);
                        setMode('select');
                        select(o.id);
                        startTextEdit(o);
                        return;
                    }
                    layer.setPointerCapture(e.pointerId);
                    if (mode === 'draw') {
                        const pts = [[p0.x, p0.y]];
                        const svg = UI.el(`<svg class="ed-draft-svg" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible"><polyline fill="none" stroke="${defaults.draw.stroke}" stroke-opacity="${defaults.draw.opacity}" stroke-width="${defaults.draw.width * zoom}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
                        layer.appendChild(svg);
                        const pl = svg.querySelector('polyline');
                        const move = (ev) => {
                            const p = toBase(layer, ev);
                            pts.push([clamp(p.x, 0, vp.width), clamp(p.y, 0, vp.height)]);
                            pl.setAttribute('points', pts.map(([x, y]) => `${x * zoom},${y * zoom}`).join(' '));
                        };
                        const up = () => {
                            layer.removeEventListener('pointermove', move);
                            svg.remove();
                            if (pts.length < 2) return;
                            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
                            const x = Math.min(...xs), y = Math.min(...ys);
                            const w = Math.max(1, Math.max(...xs) - x), h = Math.max(1, Math.max(...ys) - y);
                            snapshot();
                            objects.push({ id: ++objSeq, page: pageIdx, kind: 'draw', x, y, w, h, strokes: [pts.map(([px, py]) => [(px - x) / w, (py - y) / h])], ...defaults.draw });
                            renderObjects(pageIdx);
                            markDirty();
                        };
                        layer.addEventListener('pointermove', move);
                        layer.addEventListener('pointerup', up, { once: true });
                        return;
                    }
                    // Formas por arrastre
                    const draft = UI.el('<div class="ed-draft"></div>');
                    layer.appendChild(draft);
                    let p1 = p0;
                    const upd = () => {
                        const x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y);
                        Object.assign(draft.style, { left: x * zoom + 'px', top: y * zoom + 'px', width: Math.abs(p1.x - p0.x) * zoom + 'px', height: Math.abs(p1.y - p0.y) * zoom + 'px' });
                    };
                    const move = (ev) => { const p = toBase(layer, ev); p1 = { x: clamp(p.x, 0, vp.width), y: clamp(p.y, 0, vp.height) }; upd(); };
                    const up = () => {
                        layer.removeEventListener('pointermove', move);
                        draft.remove();
                        let x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y);
                        let w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
                        const tiny = w < 4 && h < 4;
                        const kind = mode;
                        if (tiny) {
                            const def = { highlight: [140, 18], line: [120, 0], whiteout: [120, 30] }[kind] || [120, 80];
                            [w, h] = def;
                        }
                        const o = { id: ++objSeq, page: pageIdx, kind, x, y, w, h, ...defaults[kind] };
                        if (kind === 'line') o.flip = !tiny && (p1.x - p0.x) * (p1.y - p0.y) < 0;
                        snapshot();
                        objects.push(o);
                        renderObjects(pageIdx);
                        if (kind !== 'highlight') { setMode('select'); select(o.id); }
                        markDirty();
                    };
                    layer.addEventListener('pointermove', move);
                    layer.addEventListener('pointerup', up, { once: true });
                });
            };

            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

            /* ================= Objetos ================= */
            const find = (id) => objects.find((o) => o.id === id);

            const renderAllObjects = () => infos.forEach((_, i) => renderObjects(i));

            const renderObjects = (pageIdx) => {
                const layer = infos[pageIdx].layer;
                layer.querySelectorAll('.ed-obj').forEach((n) => n.remove());
                objects.filter((o) => o.page === pageIdx).forEach((o) => layer.appendChild(objEl(o)));
            };

            const objEl = (o) => {
                const el = UI.el(`<div class="ed-obj kind-${o.kind} ${o.id === selectedId ? 'sel' : ''}" data-id="${o.id}">
                    <div class="ed-del">
                        <button type="button" data-o="front" title="Traer al frente">${icon('layers')}</button>
                        <button type="button" data-o="dup" title="Duplicar">${icon('copy')}</button>
                        <button type="button" data-o="del" title="Eliminar (Supr)">${icon('trash')}</button>
                    </div>
                    <span class="ed-handle nw" data-h="nw"></span><span class="ed-handle ne" data-h="ne"></span>
                    <span class="ed-handle sw" data-h="sw"></span><span class="ed-handle se" data-h="se"></span>
                </div>`);
                fillObj(el, o);
                el.addEventListener('pointerdown', (e) => onObjPointerDown(e, o, el));
                el.addEventListener('dblclick', () => { if (o.kind === 'text') startTextEdit(o); });
                el.querySelectorAll('[data-o]').forEach((b) => {
                    b.addEventListener('pointerdown', (e) => e.stopPropagation());
                    b.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const a = b.dataset.o;
                        if (a === 'del') removeObj(o.id);
                        if (a === 'dup') duplicateObj(o);
                        if (a === 'front') { snapshot(); objects = objects.filter((x) => x !== o).concat(o); renderObjects(o.page); }
                    });
                });
                return el;
            };

            /** Pinta el contenido del objeto según su tipo */
            const fillObj = (el, o) => {
                const z = zoom;
                el.querySelector('.ed-content')?.remove();
                let content;
                const pad = o.kind === 'line' ? 6 : 0;
                el.style.left = o.x * z - pad + 'px';
                el.style.top = o.y * z - pad + 'px';
                el.style.width = o.w * z + pad * 2 + 'px';
                el.style.height = o.h * z + pad * 2 + 'px';
                el.style.opacity = o.opacity ?? 1;
                if (o.kind === 'text') {
                    const f = FONTS[o.font];
                    content = UI.el(`<div class="ed-text ed-content" spellcheck="false"></div>`);
                    content.textContent = o.text;
                    Object.assign(content.style, { fontFamily: f.css, fontSize: o.size * z + 'px', color: o.color, fontWeight: o.bold ? '700' : '400', fontStyle: o.italic ? 'italic' : 'normal' });
                    el.style.width = 'auto';
                    el.style.height = 'auto';
                    el.style.minWidth = '8px';
                    el.style.minHeight = o.size * LINE_H * z + 'px';
                } else if (o.kind === 'image') {
                    content = UI.el(`<img class="ed-content" alt="">`);
                    content.src = o.src;
                } else if (o.kind === 'highlight' || o.kind === 'whiteout') {
                    content = UI.el(`<div class="ed-content" style="width:100%;height:100%;background:${o.fill};${o.kind === 'highlight' ? 'mix-blend-mode:multiply' : ''}"></div>`);
                } else {
                    const W = o.w * z, H = o.h * z, sw = (o.width || 1) * z;
                    let inner = '';
                    if (o.kind === 'rect') inner = `<rect x="0" y="0" width="${W}" height="${H}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.stroke ? sw : 0}"/>`;
                    if (o.kind === 'ellipse') inner = `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.stroke ? sw : 0}"/>`;
                    if (o.kind === 'line') {
                        const [a, b] = o.flip ? [[0, H], [W, 0]] : [[0, 0], [W, H]];
                        inner = `<line x1="${a[0] + pad}" y1="${a[1] + pad}" x2="${b[0] + pad}" y2="${b[1] + pad}" stroke="${o.stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
                    }
                    if (o.kind === 'draw') inner = o.strokes.map((s) => `<polyline fill="none" points="${s.map(([px, py]) => `${px * W},${py * H}`).join(' ')}" stroke="${o.stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
                    content = UI.el(`<svg class="ed-content" style="overflow:visible">${inner}</svg>`);
                }
                el.prepend(content);
                if (o.kind === 'text') requestAnimationFrame(() => measureText(o, el));
            };

            /** Actualiza w/h de un texto según su tamaño real en pantalla */
            const measureText = (o, el) => {
                el ||= els.stack.querySelector(`.ed-obj[data-id="${o.id}"]`);
                if (!el) return;
                const t = el.querySelector('.ed-text');
                o.w = Math.max(t.scrollWidth, 8) / zoom;
                o.h = Math.max(t.scrollHeight, o.size * LINE_H * zoom) / zoom;
            };

            const select = (id) => {
                selectedId = id;
                els.stack?.querySelectorAll('.ed-obj').forEach((n) => n.classList.toggle('sel', +n.dataset.id === id));
                renderProps();
            };

            const removeObj = (id) => {
                const o = find(id);
                if (!o) return;
                snapshot();
                objects = objects.filter((x) => x.id !== id);
                if (selectedId === id) selectedId = null;
                renderObjects(o.page);
                renderProps();
                markDirty();
            };

            const duplicateObj = (o) => {
                snapshot();
                const c = { ...JSON.parse(JSON.stringify(o)), id: ++objSeq, x: o.x + 12, y: o.y + 12 };
                objects.push(c);
                renderObjects(o.page);
                select(c.id);
            };

            const onObjPointerDown = (e, o, el) => {
                if (e.button !== 0) return;
                if (el.classList.contains('editing')) return; // escribiendo
                e.stopPropagation();
                e.preventDefault();
                setCurrentPage(o.page);
                if (selectedId !== o.id) select(o.id);
                const handle = e.target.closest('[data-h]')?.dataset.h;
                const start = { x: o.x, y: o.y, w: o.w, h: o.h, size: o.size, cx: e.clientX, cy: e.clientY };
                const vp = infos[o.page].vp;
                let moved = false;
                const before = JSON.stringify(objects);
                el.setPointerCapture(e.pointerId);
                const move = (ev) => {
                    const dx = (ev.clientX - start.cx) / zoom, dy = (ev.clientY - start.cy) / zoom;
                    if (!moved && Math.abs(dx) + Math.abs(dy) < 0.5) return;
                    moved = true;
                    if (!handle) {
                        o.x = clamp(start.x + dx, -o.w + 10, vp.width - 10);
                        o.y = clamp(start.y + dy, -o.h + 10, vp.height - 10);
                    } else {
                        let { x, y, w, h } = start;
                        if (handle.includes('e')) w = start.w + dx;
                        if (handle.includes('s')) h = start.h + dy;
                        if (handle.includes('w')) { w = start.w - dx; x = start.x + dx; }
                        if (handle.includes('n')) { h = start.h - dy; y = start.y + dy; }
                        const keepRatio = o.kind === 'image' || o.kind === 'text' || ev.shiftKey;
                        if (keepRatio && start.w > 0 && start.h > 0) {
                            const k = Math.max(w / start.w, h / start.h, 0.05);
                            w = start.w * k; h = start.h * k;
                            if (handle.includes('w')) x = start.x + start.w - w;
                            if (handle.includes('n')) y = start.y + start.h - h;
                        }
                        const min = o.kind === 'line' ? 0 : 4;
                        if (w < min) w = min;
                        if (h < min) h = min;
                        Object.assign(o, { x, y, w, h });
                        if (o.kind === 'text') o.size = Math.max(4, Math.round(start.size * (w / start.w) * 10) / 10);
                    }
                    fillObj(el, o);
                };
                const up = () => {
                    el.removeEventListener('pointermove', move);
                    if (moved) {
                        history.push(before);
                        markDirty();
                        if (o.kind === 'text') { measureText(o, el); renderProps(); }
                    }
                };
                el.addEventListener('pointermove', move);
                el.addEventListener('pointerup', up, { once: true });
            };

            const startTextEdit = (o) => {
                const el = els.stack.querySelector(`.ed-obj[data-id="${o.id}"]`);
                if (!el) return;
                const t = el.querySelector('.ed-text');
                el.classList.add('editing');
                try { t.contentEditable = 'plaintext-only'; } catch { t.contentEditable = 'true'; }
                if (t.contentEditable !== 'plaintext-only') t.contentEditable = 'true';
                t.focus();
                const r = document.createRange();
                r.selectNodeContents(t);
                const s = getSelection();
                s.removeAllRanges();
                s.addRange(r);
                const before = JSON.stringify(objects);
                const onInput = () => { o.text = t.innerText.replace(/\n$/, ''); measureText(o, el); };
                const finish = () => {
                    t.removeEventListener('input', onInput);
                    t.contentEditable = 'false';
                    el.classList.remove('editing');
                    o.text = t.innerText.replace(/\n$/, '');
                    if (!o.text.trim()) {
                        objects = objects.filter((x) => x !== o);
                        el.remove();
                        if (selectedId === o.id) select(null);
                    } else {
                        if (before !== JSON.stringify(objects)) history.push(before);
                        measureText(o, el);
                    }
                    markDirty();
                };
                t.addEventListener('input', onInput);
                t.addEventListener('blur', finish, { once: true });
                t.addEventListener('keydown', (e) => { if (e.key === 'Escape') t.blur(); e.stopPropagation(); });
            };

            /* ================= Teclado ================= */
            const onKey = (e) => {
                if (!file || document.querySelector('.modal-back')) return;
                if (e.target.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]')) return;
                const o = find(selectedId);
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && o) { e.preventDefault(); duplicateObj(o); return; }
                if (e.key === 'Escape') { select(null); setMode('select'); return; }
                if (!o) return;
                if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeObj(o.id); return; }
                const step = e.shiftKey ? 10 : 1;
                const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
                if (d) {
                    e.preventDefault();
                    snapshot();
                    o.x += d[0]; o.y += d[1];
                    renderObjects(o.page);
                }
                if (e.key === 'Enter' && o.kind === 'text') { e.preventDefault(); startTextEdit(o); }
            };
            document.addEventListener('keydown', onKey);
            ctx.onCleanup(() => document.removeEventListener('keydown', onKey));

            /* ================= Panel de propiedades ================= */
            const renderProps = () => {
                if (!file) return;
                const o = find(selectedId);
                const kind = o ? o.kind : mode;
                const p = o || defaults[kind];
                const apply = (changes) => {
                    if (o) {
                        snapshot();
                        Object.assign(o, changes);
                        renderObjects(o.page);
                        if (o.kind === 'text') measureText(o);
                    }
                    if (defaults[kind]) Object.assign(defaults[kind], Object.fromEntries(Object.entries(changes).filter(([k]) => k in defaults[kind])));
                };
                const title = { text: 'Texto', image: 'Imagen', rect: 'Rectángulo', ellipse: 'Círculo', line: 'Línea', draw: 'Dibujo', highlight: 'Resaltado', whiteout: 'Tapar' }[kind];
                let html = '';
                if (!p) {
                    html = `<div class="empty-props">${icon('cursor')}${HELP.select}</div>`;
                } else {
                    html += `<div class="side-title">${o ? 'Elemento seleccionado' : 'Herramienta'}: ${title}</div>`;
                    if (!o && HELP[kind]) html += `<p class="hint" style="margin:-4px 0 16px">${HELP[kind]}</p>`;
                    if (kind === 'text') {
                        html += `<div class="field"><label>Fuente</label><div class="segmented" data-g="font">${Object.entries(FONTS).map(([k, f]) => `<button type="button" data-value="${k}" aria-pressed="${p.font === k}" style="font-family:${f.css.replace(/"/g, "'")}">${f.label}</button>`).join('')}</div></div>
                            <div class="field"><label>Tamaño</label>${Comp.range({ id: 'pSize', min: 6, max: 96, value: Math.round(p.size), unit: ' pt' })}</div>
                            <div class="field"><label>Estilo</label><div class="field-row"><button type="button" class="btn btn-sm" data-t="bold" aria-pressed="${!!p.bold}"><b>N</b> Negrita</button><button type="button" class="btn btn-sm" data-t="italic" aria-pressed="${!!p.italic}"><i>K</i> Cursiva</button></div></div>
                            <div class="field"><label>Color</label>${swatches('color', p.color, PALETTE)}</div>`;
                        if (o) html += Comp.infoBox('Doble clic sobre el texto (o Enter) para editarlo. Las esquinas cambian el tamaño de letra.');
                    }
                    if (kind === 'rect' || kind === 'ellipse') {
                        html += `<div class="field"><label>Borde</label>${swatches('stroke', p.stroke, PALETTE, true)}</div>
                            <div class="field"><label>Relleno</label>${swatches('fill', p.fill, PALETTE, true)}</div>
                            <div class="field"><label>Grosor del borde</label>${Comp.range({ id: 'pWidth', min: 0.5, max: 20, step: 0.5, value: p.width, unit: ' pt' })}</div>
                            <div class="field"><label>Opacidad</label>${Comp.range({ id: 'pOpacity', min: 10, max: 100, value: Math.round(p.opacity * 100), unit: '%' })}</div>`;
                    }
                    if (kind === 'line' || kind === 'draw') {
                        html += `<div class="field"><label>Color</label>${swatches('stroke', p.stroke, PALETTE)}</div>
                            <div class="field"><label>Grosor</label>${Comp.range({ id: 'pWidth', min: 0.5, max: 20, step: 0.5, value: p.width, unit: ' pt' })}</div>
                            <div class="field"><label>Opacidad</label>${Comp.range({ id: 'pOpacity', min: 10, max: 100, value: Math.round(p.opacity * 100), unit: '%' })}</div>`;
                    }
                    if (kind === 'highlight') {
                        html += `<div class="field"><label>Color</label>${swatches('fill', p.fill, HL_PALETTE)}</div>
                            <div class="field"><label>Intensidad</label>${Comp.range({ id: 'pOpacity', min: 15, max: 90, value: Math.round(p.opacity * 100), unit: '%' })}</div>`;
                    }
                    if (kind === 'whiteout') {
                        html += `<div class="field"><label>Color del recuadro</label>${swatches('fill', p.fill, PALETTE)}</div>`;
                        html += Comp.infoBox('Esto cubre la zona visualmente. El contenido original sigue en el archivo y podría copiarse. No lo uses para ocultar datos sensibles.', true);
                    }
                    if (kind === 'image') {
                        html += `<div class="field"><label>Opacidad</label>${Comp.range({ id: 'pOpacity', min: 10, max: 100, value: Math.round((p.opacity ?? 1) * 100), unit: '%' })}</div>`;
                    }
                    if (o) {
                        html += `<div class="field" style="margin-top:20px"><div class="field-row">
                            <button type="button" class="btn btn-sm" data-act="dup">${icon('copy')}Duplicar</button>
                            <button type="button" class="btn btn-sm btn-danger" data-act="del">${icon('trash')}Eliminar</button></div></div>`;
                    }
                }
                const sigs = signatures.length ? `<div class="side-block"><div class="side-title">Tus firmas (esta sesión)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${signatures.map((s, i) => `<button type="button" class="btn" data-sig="${i}" style="height:64px;padding:6px;background:#fff"><img src="${s.src}" alt="Firma ${i + 1}" style="max-width:100%;max-height:100%"></button>`).join('')}</div><p class="hint">Haz clic para insertar de nuevo.</p></div>` : '';
                ctx.side.innerHTML = `<div class="side-block">${html}</div>${sigs}
                    <div class="side-block"><div class="side-title">Documento</div>
                    <div class="stat-row"><span>Archivo</span><span style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(file.name)}</span></div>
                    <div class="stat-row"><span>Páginas</span><span>${file.pageCount}</span></div>
                    <div class="stat-row"><span>Elementos añadidos</span><span>${objects.length}</span></div></div>`;
                // Controles
                const s = ctx.side;
                Comp.bindRanges(s, { pSize: ' pt', pWidth: ' pt', pOpacity: '%' });
                s.querySelector('[data-g="font"]') && UI.bindChoice(s.querySelector('[data-g="font"]'), 'button', (v) => apply({ font: v }));
                s.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
                    const k = b.dataset.t;
                    const v = !(p[k]);
                    b.setAttribute('aria-pressed', String(v));
                    apply({ [k]: v });
                }));
                const live = (id, fn) => {
                    const r = s.querySelector('#' + id);
                    if (!r) return;
                    let snapped = false;
                    r.addEventListener('input', () => {
                        if (o && !snapped) { snapshot(); snapped = true; }
                        const val = fn(+r.value);
                        if (o) { Object.assign(o, val); renderObjects(o.page); if (o.kind === 'text') measureText(o); }
                        if (defaults[kind]) Object.assign(defaults[kind], val);
                    });
                    r.addEventListener('change', () => { snapped = false; });
                };
                live('pSize', (v) => ({ size: v }));
                live('pWidth', (v) => ({ width: v }));
                live('pOpacity', (v) => ({ opacity: v / 100 }));
                s.querySelectorAll('.swatches').forEach((sw) => {
                    const prop = sw.dataset.prop;
                    sw.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
                        sw.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
                        apply({ [prop]: b.dataset.value });
                    }));
                    sw.querySelector('input[type="color"]')?.addEventListener('change', (e) => {
                        sw.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
                        apply({ [prop]: e.target.value });
                    });
                });
                s.querySelector('[data-act="dup"]')?.addEventListener('click', () => duplicateObj(o));
                s.querySelector('[data-act="del"]')?.addEventListener('click', () => removeObj(o.id));
                s.querySelectorAll('[data-sig]').forEach((b) => b.addEventListener('click', () => insertSignature(signatures[+b.dataset.sig])));
            };

            const swatches = (prop, value, colors, allowNone) => `<div class="swatches" data-prop="${prop}">
                ${allowNone ? `<button type="button" data-value="" aria-pressed="${!value}" title="Sin color" style="background:linear-gradient(135deg,#fff 45%,#e5484d 45%,#e5484d 55%,#fff 55%)"></button>` : ''}
                ${colors.map((c) => `<button type="button" data-value="${c}" aria-pressed="${value === c}" style="background:${c}" title="${c}"></button>`).join('')}
                <input type="color" value="${value && value.length === 7 ? value : '#000000'}" title="Otro color">
            </div>`;

            const renderFooter = () => {
                ctx.footer.innerHTML = '';
                const change = UI.el(`<button class="btn">${icon('file')}Abrir otro PDF</button>`);
                change.addEventListener('click', async () => {
                    if (objects.length && !(await UI.confirm('¿Abrir otro PDF?', 'Se perderán los cambios no guardados.', 'Abrir otro'))) return;
                    const f = await UI.pickFiles({ multiple: false });
                    if (f.length) load(f);
                });
                const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('download')}Guardar PDF</button>`);
                go.addEventListener('click', save);
                ctx.footer.append(change, go);
            };

            /* ================= Imágenes y firmas ================= */
            const pickImage = async () => {
                const [f] = await UI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp', multiple: false });
                if (!f) return;
                await UI.task('Cargando imagen…', async () => {
                    const img = await Engine.prepareImage(f);
                    const src = `data:image/${img.type === 'jpg' ? 'jpeg' : 'png'};base64,${bytesToB64(img.bytes)}`;
                    placeImage(src, img.width, img.height);
                });
            };

            const placeImage = (src, iw, ih, maxW = 220) => {
                const vp = infos[currentPage].vp;
                const w = Math.min(maxW, vp.width * 0.6);
                const h = (w * ih) / iw;
                placeCentered({ kind: 'image', src, opacity: 1 }, w, h);
            };

            const insertSignature = (s) => placeImage(s.src, s.width, s.height, 170);

            const bytesToB64 = (bytes) => {
                let bin = '';
                for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                return btoa(bin);
            };

            const openSignature = async () => {
                const sig = await Signature.open();
                if (!sig) return;
                signatures.push(sig);
                insertSignature(sig);
            };

            /* ================= Guardar ================= */
            const save = () => UI.task('Guardando PDF…', async () => {
                // termina cualquier edición de texto en curso
                document.activeElement?.blur();
                const doc = await Engine.freshDoc(file);
                const pages = doc.getPages();
                const fontCache = {};
                const getFont = async (o) => {
                    const key = FONTS[o.font].std[o.bold && o.italic ? 'bi' : o.bold ? 'b' : o.italic ? 'i' : 'n'];
                    return (fontCache[key] ||= await doc.embedFont(StandardFonts[key]));
                };
                const imgCache = new Map();
                const getImg = async (src) => {
                    if (!imgCache.has(src)) {
                        const bytes = Engine.dataUrlToBytes(src);
                        imgCache.set(src, src.startsWith('data:image/jpeg') ? await doc.embedJpg(bytes) : await doc.embedPng(bytes));
                    }
                    return imgCache.get(src);
                };
                let lostChars = false;
                const byPage = new Map();
                objects.forEach((o) => { if (!byPage.has(o.page)) byPage.set(o.page, []); byPage.get(o.page).push(o); });
                let n = 0;
                for (const [pi, list] of byPage) {
                    UI.progress(n++, byPage.size);
                    const page = pages[pi];
                    Engine.isolatePage(doc, page);
                    const vp = infos[pi].vp;
                    const P = (x, y) => { const [a, b] = vp.convertToPdfPoint(x, y); return { x: a, y: b }; };
                    const o0 = P(0, 0), o1 = P(1, 0);
                    const rot = degrees((Math.atan2(o1.y - o0.y, o1.x - o0.x) * 180) / Math.PI);
                    for (const o of list) {
                        const bl = P(o.x, o.y + o.h); // esquina inferior izquierda visual
                        const opacity = o.opacity ?? 1;
                        switch (o.kind) {
                            case 'text': {
                                const font = await getFont(o);
                                const lines = o.text.split('\n');
                                lines.forEach((line, i) => {
                                    const { text, lost } = Engine.safeText(font, line);
                                    lostChars ||= lost;
                                    if (!text) return;
                                    const pt = P(o.x, o.y + i * o.size * LINE_H + FONTS[o.font].base * o.size);
                                    page.drawText(text, { x: pt.x, y: pt.y, size: o.size, font, color: Engine.hexToRgb(o.color), rotate: rot, opacity });
                                });
                                break;
                            }
                            case 'image':
                                page.drawImage(await getImg(o.src), { x: bl.x, y: bl.y, width: o.w, height: o.h, rotate: rot, opacity });
                                break;
                            case 'rect':
                                page.drawRectangle({
                                    x: bl.x, y: bl.y, width: o.w, height: o.h, rotate: rot,
                                    color: o.fill ? Engine.hexToRgb(o.fill) : undefined, opacity,
                                    borderColor: o.stroke ? Engine.hexToRgb(o.stroke) : undefined, borderWidth: o.stroke ? o.width : 0, borderOpacity: opacity,
                                });
                                break;
                            case 'ellipse': {
                                const c = P(o.x + o.w / 2, o.y + o.h / 2);
                                page.drawEllipse({
                                    x: c.x, y: c.y, xScale: o.w / 2, yScale: o.h / 2, rotate: rot,
                                    color: o.fill ? Engine.hexToRgb(o.fill) : undefined, opacity,
                                    borderColor: o.stroke ? Engine.hexToRgb(o.stroke) : undefined, borderWidth: o.stroke ? o.width : 0, borderOpacity: opacity,
                                });
                                break;
                            }
                            case 'highlight':
                                page.drawRectangle({ x: bl.x, y: bl.y, width: o.w, height: o.h, rotate: rot, color: Engine.hexToRgb(o.fill), opacity, blendMode: BlendMode.Multiply });
                                break;
                            case 'whiteout':
                                page.drawRectangle({ x: bl.x, y: bl.y, width: o.w, height: o.h, rotate: rot, color: Engine.hexToRgb(o.fill) });
                                break;
                            case 'line': {
                                const [a, b] = o.flip ? [P(o.x, o.y + o.h), P(o.x + o.w, o.y)] : [P(o.x, o.y), P(o.x + o.w, o.y + o.h)];
                                page.drawLine({ start: a, end: b, thickness: o.width, color: Engine.hexToRgb(o.stroke), opacity, lineCap: LineCapStyle.Round });
                                break;
                            }
                            case 'draw': {
                                // Ruta SVG en coordenadas PDF (pdf-lib invierte el eje Y)
                                const path = o.strokes.map((s) => s.map(([px, py], i) => {
                                    const q = P(o.x + px * o.w, o.y + py * o.h);
                                    return `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${(-q.y).toFixed(2)}`;
                                }).join(' ')).join(' ');
                                page.drawSvgPath(path, { x: 0, y: 0, borderColor: Engine.hexToRgb(o.stroke), borderWidth: o.width, borderOpacity: opacity, borderLineCap: LineCapStyle.Round });
                                break;
                            }
                        }
                    }
                }
                const bytes = await Engine.save(doc);
                if (lostChars) UI.toast('Algunos caracteres especiales (emojis, etc.) no son compatibles y se reemplazaron por "?"', 'warn', 7000);
                const name = UI.baseName(file.name) + '_editado.pdf';
                ctx.body.style.padding = '';
                Comp.finish(ctx, {
                    out: { bytes, name },
                    title: '¡PDF guardado!',
                    sub: `<b>${UI.esc(name)}</b> · ${UI.plural(objects.length, 'elemento añadido', 'elementos añadidos')} · ${UI.formatBytes(bytes.length)}`,
                    onBack: () => { buildEditor(); },
                    backLabel: 'Seguir editando',
                });
            });

            /* ================= Inicio ================= */
            const renderEmpty = () => {
                ctx.sideWrap.hidden = true;
                ctx.body.style.padding = '';
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres editar o firmar', multiple: false, color: ctx.tool.color, iconName: 'edit', button: 'Elegir PDF', onFiles: load }));
            };
            const handoff = Tools.takeHandoff();
            renderEmpty();
            if (handoff) load(handoff);
        },
    });

    /* ================= Modal de firma ================= */
    const Signature = {
        open() {
            let tab = 'draw';
            let color = '#111111';
            let typed = '';
            let typedFont = "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
            let uploaded = null;
            let removeBg = true;
            let pad;
            return UI.modal({
                title: 'Crear firma',
                sub: 'La firma se crea y se queda en tu dispositivo.',
                wide: true,
                body: `<div class="segmented sig-tabs" data-tabs>
                        <button type="button" data-value="draw" aria-pressed="true">${icon('pencil')}Dibujar</button>
                        <button type="button" data-value="type" aria-pressed="false">${icon('type')}Escribir</button>
                        <button type="button" data-value="upload" aria-pressed="false">${icon('upload')}Subir imagen</button>
                    </div>
                    <div data-pane></div>
                    <div class="field-row" style="margin-top:12px;align-items:center">
                        <div class="swatches" data-colors>${['#111111', '#1b4fd8', '#0d3a8c', '#c9363b'].map((c, i) => `<button type="button" data-value="${c}" aria-pressed="${i === 0}" style="background:${c}"></button>`).join('')}</div>
                        <span style="flex:0"></span>
                    </div>`,
                actions: [
                    { label: 'Cancelar', value: null },
                    {
                        label: 'Insertar firma', primary: true, icon: 'check', onClick: async (close) => {
                            const r = await exportSig();
                            if (!r) return UI.toast(tab === 'upload' ? 'Elige una imagen' : 'La firma está vacía', 'warn');
                            close(r);
                        },
                    },
                ],
            }, (m) => {
                const pane = m.querySelector('[data-pane]');
                const showPane = () => {
                    m.querySelector('[data-colors]').style.visibility = tab === 'upload' ? 'hidden' : 'visible';
                    if (tab === 'draw') {
                        pane.innerHTML = `<canvas class="sig-pad"></canvas><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px"><span class="hint">Firma con el ratón, el dedo o un lápiz.</span><button type="button" class="btn btn-sm" data-clear>${icon('trash')}Borrar</button></div>`;
                        pad = setupPad(pane.querySelector('canvas'), () => color);
                        pane.querySelector('[data-clear]').addEventListener('click', () => pad.clear());
                    } else if (tab === 'type') {
                        const fonts = [["'Segoe Script', 'Brush Script MT', cursive", 'Manuscrita'], ["'Lucida Handwriting', 'Segoe Script', cursive", 'Caligrafía'], ["'Brush Script MT', 'Segoe Script', cursive", 'Pincel'], ["'Ink Free', 'Segoe Print', cursive", 'Informal']];
                        pane.innerHTML = `<div class="field"><input class="input" data-name placeholder="Escribe tu nombre" value="${UI.esc(typed)}"></div>
                            <div class="sig-type-preview" data-prev></div>
                            <div class="segmented" data-fonts style="margin-top:10px">${fonts.map(([f, l]) => `<button type="button" data-value="${UI.esc(f)}" aria-pressed="${f === typedFont}" style="font-family:${f.replace(/"/g, "'")};font-size:15px">${l}</button>`).join('')}</div>`;
                        const prev = pane.querySelector('[data-prev]');
                        const upd = () => { prev.textContent = typed || 'Tu firma'; prev.style.fontFamily = typedFont; prev.style.color = typed ? color : '#bbb'; };
                        pane.querySelector('[data-name]').addEventListener('input', (e) => { typed = e.target.value; upd(); });
                        UI.bindChoice(pane.querySelector('[data-fonts]'), 'button', (v) => { typedFont = v; upd(); });
                        upd();
                        pane.querySelector('[data-name]').focus();
                    } else {
                        pane.innerHTML = `<div class="sig-type-preview" data-up style="cursor:pointer;font-size:15px;color:#777">${uploaded ? '' : 'Haz clic para elegir una imagen de tu firma'}</div>
                            <label class="check" style="margin-top:10px"><input type="checkbox" data-bg ${removeBg ? 'checked' : ''}>Quitar el fondo blanco</label>`;
                        const box = pane.querySelector('[data-up]');
                        const show = async () => {
                            if (!uploaded) return;
                            const r = await processUpload();
                            box.innerHTML = `<img src="${r.src}" style="max-height:110px;max-width:90%">`;
                        };
                        box.addEventListener('click', async () => {
                            const [f] = await UI.pickFiles({ accept: 'image/*', multiple: false });
                            if (f) { uploaded = f; show(); }
                        });
                        pane.querySelector('[data-bg]').addEventListener('change', (e) => { removeBg = e.target.checked; show(); });
                        show();
                    }
                };
                UI.bindChoice(m.querySelector('[data-tabs]'), 'button', (v) => { tab = v; showPane(); });
                UI.bindChoice(m.querySelector('[data-colors]'), 'button', (v) => {
                    color = v;
                    if (tab === 'type') { const p = pane.querySelector('[data-prev]'); if (typed) p.style.color = v; }
                    if (tab === 'draw') pad.recolor(v);
                });
                showPane();
            });

            async function processUpload() {
                const bmp = await createImageBitmap(uploaded, { imageOrientation: 'from-image' });
                const c = document.createElement('canvas');
                const k = Math.min(1, 1200 / bmp.width);
                c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
                const g = c.getContext('2d');
                g.drawImage(bmp, 0, 0, c.width, c.height);
                bmp.close();
                if (removeBg) {
                    const d = g.getImageData(0, 0, c.width, c.height);
                    for (let i = 0; i < d.data.length; i += 4) {
                        const lum = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3;
                        if (lum > 215) d.data[i + 3] = 0;
                        else if (lum > 170) d.data[i + 3] = Math.round(d.data[i + 3] * (215 - lum) / 45);
                    }
                    g.putImageData(d, 0, 0);
                }
                return trimCanvas(c);
            }

            async function exportSig() {
                if (tab === 'draw') return pad.isEmpty() ? null : trimCanvas(pad.canvas);
                if (tab === 'type') {
                    if (!typed.trim()) return null;
                    const c = document.createElement('canvas');
                    const g = c.getContext('2d');
                    const size = 120;
                    g.font = `${size}px ${typedFont}`;
                    const w = Math.ceil(g.measureText(typed).width) + 60;
                    c.width = w; c.height = size * 1.8;
                    g.font = `${size}px ${typedFont}`;
                    g.fillStyle = color;
                    g.textBaseline = 'middle';
                    g.fillText(typed, 30, c.height / 2);
                    return trimCanvas(c);
                }
                return uploaded ? processUpload() : null;
            }
        },
    };

    /** Lienzo para dibujar la firma, con trazo suavizado */
    function setupPad(canvas, getColor) {
        const dpr = Math.min(devicePixelRatio || 1, 2) * 1.5;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const g = canvas.getContext('2d');
        g.scale(dpr, dpr);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        const strokes = [];
        let cur = null;
        const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pressure || 0.5]; };
        const redraw = () => {
            g.clearRect(0, 0, canvas.width, canvas.height);
            strokes.forEach((s) => drawStroke(s));
        };
        const drawStroke = (s) => {
            g.strokeStyle = s.color;
            if (s.pts.length === 1) { g.fillStyle = s.color; g.beginPath(); g.arc(s.pts[0][0], s.pts[0][1], 1.6, 0, 7); g.fill(); return; }
            for (let i = 1; i < s.pts.length; i++) {
                const [x0, y0] = s.pts[i - 1], [x1, y1, p] = s.pts[i];
                g.lineWidth = 1.6 + p * 2.4;
                g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            }
        };
        canvas.addEventListener('pointerdown', (e) => {
            canvas.setPointerCapture(e.pointerId);
            cur = { color: getColor(), pts: [pos(e)] };
            strokes.push(cur);
            drawStroke(cur);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!cur) return;
            cur.pts.push(pos(e));
            const n = cur.pts.length;
            drawStroke({ color: cur.color, pts: cur.pts.slice(n - 2) });
        });
        const end = () => { cur = null; };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        return {
            canvas,
            clear() { strokes.length = 0; redraw(); },
            isEmpty: () => !strokes.length,
            recolor(c) { strokes.forEach((s) => { s.color = c; }); redraw(); },
        };
    }

    /** Recorta los bordes transparentes y devuelve { src, width, height } */
    function trimCanvas(c) {
        const g = c.getContext('2d');
        const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
        let x0 = width, y0 = height, x1 = -1, y1 = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > 8) {
                    if (x < x0) x0 = x; if (x > x1) x1 = x;
                    if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
            }
        }
        if (x1 < 0) return null;
        const m = 6;
        x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
        x1 = Math.min(width - 1, x1 + m); y1 = Math.min(height - 1, y1 + m);
        const out = document.createElement('canvas');
        out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
        out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
        return { src: out.toDataURL('image/png'), width: out.width, height: out.height };
    }
})();

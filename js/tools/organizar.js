/* Organizar páginas: reordenar arrastrando, rotar, eliminar, duplicar, insertar en blanco, extraer */
(function () {
    const { degrees } = PDFLib;

    /**
     * Construye un PDF a partir de una lista de páginas:
     * items = [{ file, index, rotation }] o [{ blank: {width,height}, rotation }]
     * (se reutiliza desde otras herramientas)
     */
    async function buildFromItems(items, onProgress) {
        const out = await Engine.newDoc();
        const copied = new Array(items.length);
        // Agrupa por archivo para copiar recursos compartidos una sola vez
        const byFile = new Map();
        items.forEach((it, k) => {
            if (it.blank) return;
            if (!byFile.has(it.file)) byFile.set(it.file, []);
            byFile.get(it.file).push(k);
        });
        let n = 0;
        for (const [file, ks] of byFile) {
            const src = await Engine.libDoc(file);
            const seen = new Set();
            const first = [], repeats = [];
            for (const k of ks) {
                if (seen.has(items[k].index)) repeats.push(k);
                else { first.push(k); seen.add(items[k].index); }
            }
            const pages = await out.copyPages(src, first.map((k) => items[k].index));
            first.forEach((k, j) => { copied[k] = pages[j]; });
            // las páginas duplicadas necesitan copias independientes
            for (const k of repeats) [copied[k]] = await out.copyPages(src, [items[k].index]);
            onProgress?.(++n, byFile.size);
        }
        items.forEach((it, k) => {
            let page;
            if (it.blank) page = out.addPage([it.blank.width, it.blank.height]);
            else page = out.addPage(copied[k]);
            if (it.rotation) {
                const base = page.getRotation().angle || 0;
                page.setRotation(degrees((((base + it.rotation) % 360) + 360) % 360));
            }
        });
        return out;
    }
    window.Organizer = { buildFromItems };

    Tools.register({
        id: 'organizar',
        name: 'Organizar páginas',
        desc: 'Reordena, rota, elimina, duplica o inserta páginas visualmente.',
        icon: 'grid',
        color: '#3b6fe0',
        section: 'organizar',
        mount(ctx) {
            let items = []; // { uid, file, index, rotation, blank? }
            let files = [];
            let selected = new Set();
            let lastClicked = null;
            let thumbSize = 150;
            let outName = 'organizado.pdf';
            const history = [];
            let uidSeq = 0;

            const snapshot = () => {
                history.push(items.map((i) => ({ ...i })));
                if (history.length > 50) history.shift();
            };
            const undo = () => {
                if (!history.length) return UI.toast('Nada que deshacer', 'info');
                items = history.pop();
                selected.clear();
                render();
            };

            const addFiles = async (list, at) => {
                const loaded = await Engine.loadMany(list);
                if (!loaded.length) return;
                snapshot();
                if (!files.length) outName = UI.baseName(loaded[0].name) + '_organizado.pdf';
                files.push(...loaded);
                const newItems = loaded.flatMap((f) => Array.from({ length: f.pageCount }, (_, i) => ({ uid: ++uidSeq, file: f, index: i, rotation: 0 })));
                if (at === undefined) items.push(...newItems); else items.splice(at, 0, ...newItems);
                Tools.dirty = true;
                render();
            };

            ctx.onCleanup(Comp.windowDrop('Suelta para añadir páginas', (f) => addFiles(f), () => files.length > 0));
            ctx.onCleanup(() => { Tools.dirty = false; });

            const selIdx = () => items.map((it, i) => (selected.has(it.uid) ? i : -1)).filter((i) => i >= 0);
            const targets = () => (selected.size ? items.filter((i) => selected.has(i.uid)) : items);

            const rotate = (list, d) => { snapshot(); list.forEach((it) => { it.rotation = (((it.rotation + d) % 360) + 360) % 360; }); refreshRotations(); };
            const remove = (list) => {
                if (list.length >= items.length) return UI.toast('No puedes eliminar todas las páginas', 'warn');
                snapshot();
                const ids = new Set(list.map((i) => i.uid));
                items = items.filter((i) => !ids.has(i.uid));
                ids.forEach((id) => selected.delete(id));
                render();
            };
            const duplicate = (list) => {
                snapshot();
                const ids = new Set(list.map((i) => i.uid));
                const next = [];
                items.forEach((it) => { next.push(it); if (ids.has(it.uid)) next.push({ ...it, uid: ++uidSeq }); });
                items = next;
                render();
            };
            const insertBlank = async () => {
                snapshot();
                const idx = selected.size ? Math.max(...selIdx()) + 1 : items.length;
                const ref = items[Math.max(0, idx - 1)];
                let size = { width: 595.28, height: 841.89 };
                if (ref && !ref.blank) { const s = await Engine.pageSize(ref.file, ref.index); size = { width: s.width, height: s.height }; }
                else if (ref?.blank) size = ref.blank;
                items.splice(idx, 0, { uid: ++uidSeq, blank: size, rotation: 0 });
                render();
                UI.toast('Página en blanco insertada', 'ok');
            };

            /* ---------- Rotación visual de miniaturas ---------- */
            const applyRotation = (el, it) => {
                const img = el.querySelector('.thumb');
                const wrap = el.querySelector('.thumb-wrap');
                const doIt = () => {
                    const deg = it.rotation;
                    let k = 1;
                    if (deg % 180) {
                        const W = wrap.clientWidth, H = wrap.clientHeight;
                        const dw = img.offsetWidth || W, dh = img.offsetHeight || H;
                        k = Math.min(1, W / dh, H / dw);
                    }
                    img.style.transform = `rotate(${deg}deg) scale(${k})`;
                };
                if (img.classList.contains('placeholder')) img.addEventListener('thumbready', doIt, { once: true });
                doIt();
            };
            const refreshRotations = () => {
                ctx.body.querySelectorAll('.page-item').forEach((el) => {
                    const it = items.find((i) => String(i.uid) === el.dataset.uid);
                    if (it) applyRotation(el, it);
                });
            };

            /* ---------- Render ---------- */
            const render = () => {
                ctx.sideWrap.hidden = !items.length;
                if (!items.length) {
                    ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta un PDF para organizar sus páginas', sub: 'También puedes soltar varios: sus páginas se combinarán', color: ctx.tool.color, iconName: 'grid', onFiles: (f) => addFiles(f) }));
                    return;
                }
                const wrap = UI.el(`<div>
                    <div class="toolbar">
                        <button class="btn" data-a="add">${icon('filePlus')}Añadir PDF</button>
                        <button class="btn" data-a="blank">${icon('fileBlank')}Página en blanco</button>
                        <div class="toolbar-group">
                            <button class="btn btn-sm btn-ghost" data-a="rotL" title="Girar a la izquierda">${icon('rotateCcw')}</button>
                            <button class="btn btn-sm btn-ghost" data-a="rotR" title="Girar a la derecha">${icon('rotateCw')}</button>
                            <button class="btn btn-sm btn-ghost" data-a="dup" title="Duplicar">${icon('copy')}</button>
                            <button class="btn btn-sm btn-ghost btn-danger" data-a="del" title="Eliminar">${icon('trash')}</button>
                        </div>
                        <button class="btn btn-sm" data-a="undo" title="Deshacer (Ctrl+Z)">${icon('undo')}Deshacer</button>
                        <span class="spacer"></span>
                        <div class="zoom-ctl">${icon('zoomOut', 'zi')}<input type="range" min="90" max="300" value="${thumbSize}" data-a="zoom" style="width:110px;accent-color:var(--accent)">${icon('zoomIn', 'zi')}</div>
                    </div>
                    <div class="hint" data-selinfo style="margin:-6px 0 14px"></div>
                    <div class="page-grid" style="--thumb:${thumbSize}px"></div>
                </div>`);
                wrap.querySelectorAll('.zi').forEach((s) => s.setAttribute('style', 'width:18px;height:18px;fill:none;stroke:var(--text-3);stroke-width:2'));
                const grid = wrap.querySelector('.page-grid');
                items.forEach((it, i) => grid.appendChild(pageEl(it, i)));
                bindToolbar(wrap);
                Sortable.create(grid, {
                    animation: 160,
                    multiDrag: false,
                    filter: '.page-actions, .page-check',
                    preventOnFilter: false,
                    onStart: () => snapshot(),
                    onEnd: (e) => {
                        if (e.oldIndex === e.newIndex) { history.pop(); return; }
                        const [m] = items.splice(e.oldIndex, 1);
                        items.splice(e.newIndex, 0, m);
                        relabel(grid);
                    },
                });
                ctx.body.replaceChildren(wrap);
                requestAnimationFrame(refreshRotations);
                updateSel();
                renderSide();
            };

            const relabel = (grid) => {
                grid.querySelectorAll('.page-item').forEach((el, i) => { el.querySelector('[data-num]').textContent = i + 1; });
            };

            const pageEl = (it, i) => {
                const el = UI.el(`<div class="page-item ${it.blank ? 'blank' : ''} ${selected.has(it.uid) ? 'selected' : ''}" data-uid="${it.uid}">
                    <div class="page-check"></div>
                    <div class="page-actions">
                        <button type="button" data-p="rotL" title="Girar izquierda">${icon('rotateCcw')}</button>
                        <button type="button" data-p="rotR" title="Girar derecha">${icon('rotateCw')}</button>
                        <button type="button" data-p="del" title="Eliminar">${icon('trash')}</button>
                    </div>
                    <div class="thumb-wrap"></div>
                    <div class="page-label">${it.blank ? '' : `<span class="src-dot" style="background:${it.file.color}" title="${UI.esc(it.file.name)}"></span>`}<span data-num>${i + 1}</span>${it.blank ? ' · en blanco' : ''}</div>
                </div>`);
                const tw = el.querySelector('.thumb-wrap');
                if (it.blank) {
                    const b = UI.el('<div class="thumb"></div>');
                    const r = it.blank.width / it.blank.height;
                    b.style.cssText = r < 1 ? 'height:100%;aspect-ratio:' + r : 'width:100%;aspect-ratio:' + r;
                    tw.appendChild(b);
                } else tw.appendChild(Engine.lazyThumb(it.file, it.index, 260));
                el.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const a = b.dataset.p;
                    if (a === 'rotL') rotate([it], -90);
                    if (a === 'rotR') rotate([it], 90);
                    if (a === 'del') remove([it]);
                }));
                el.addEventListener('click', (e) => onPageClick(e, it));
                el.addEventListener('dblclick', () => openLarge(it));
                return el;
            };

            const onPageClick = (e, it) => {
                const idx = items.indexOf(it);
                if (e.shiftKey && lastClicked !== null) {
                    const a = Math.min(lastClicked, idx), b = Math.max(lastClicked, idx);
                    for (let i = a; i <= b; i++) selected.add(items[i].uid);
                } else if (e.ctrlKey || e.metaKey || e.target.closest('.page-check') || selected.size) {
                    selected.has(it.uid) ? selected.delete(it.uid) : selected.add(it.uid);
                } else {
                    selected = new Set([it.uid]);
                }
                lastClicked = idx;
                ctx.body.querySelectorAll('.page-item').forEach((el) => el.classList.toggle('selected', selected.has(+el.dataset.uid)));
                updateSel();
            };

            const updateSel = () => {
                const info = ctx.body.querySelector('[data-selinfo]');
                if (!info) return;
                info.innerHTML = selected.size
                    ? `<b>${UI.plural(selected.size, 'página seleccionada', 'páginas seleccionadas')}</b> · las acciones de la barra se aplican a la selección · <a href="#" data-clear>Quitar selección</a>`
                    : `${icon('handSelect')}Clic para seleccionar · Shift+clic para un rango · arrastra para reordenar · doble clic para ampliar`;
                info.querySelector('[data-clear]')?.addEventListener('click', (e) => { e.preventDefault(); selected.clear(); render(); });
                const ex = ctx.footer.querySelector('[data-extract]');
                if (ex) { ex.disabled = !selected.size; ex.innerHTML = `${icon('download')}Extraer ${selected.size ? UI.plural(selected.size, 'página', 'páginas') : 'selección'}`; }
            };

            const bindToolbar = (wrap) => {
                const on = (a, fn) => wrap.querySelector(`[data-a="${a}"]`).addEventListener('click', fn);
                on('add', async () => addFiles(await UI.pickFiles()));
                on('blank', insertBlank);
                on('rotL', () => rotate(targets(), -90));
                on('rotR', () => rotate(targets(), 90));
                on('dup', () => duplicate(targets()));
                on('del', () => {
                    if (!selected.size) return UI.toast('Selecciona las páginas que quieres eliminar', 'info');
                    remove(targets());
                });
                on('undo', undo);
                wrap.querySelector('[data-a="zoom"]').addEventListener('input', (e) => {
                    thumbSize = +e.target.value;
                    wrap.querySelector('.page-grid').style.setProperty('--thumb', thumbSize + 'px');
                    refreshRotations();
                });
            };

            const onKey = (e) => {
                if (!items.length || e.target.closest('input, textarea') || document.querySelector('.modal-back')) return;
                if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
                else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selected = new Set(items.map((i) => i.uid)); render(); }
                else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) { e.preventDefault(); remove(targets()); }
                else if (e.key === 'Escape' && selected.size) { selected.clear(); render(); }
            };
            document.addEventListener('keydown', onKey);
            ctx.onCleanup(() => document.removeEventListener('keydown', onKey));

            /** Vista ampliada de una página */
            const openLarge = async (it) => {
                if (it.blank) return;
                const pos = items.indexOf(it) + 1;
                UI.modal({ title: `Página ${pos}`, sub: UI.esc(it.file.name) + ` · página original ${it.index + 1}`, wide: true, body: '<div style="display:grid;place-items:center;min-height:300px" data-c></div>', actions: [{ label: 'Cerrar', value: null, primary: true }] }, async (m) => {
                    const { canvas } = await Engine.renderToCanvas(it.file, it.index, { width: 1300, rotation: it.rotation });
                    canvas.style.cssText = 'max-width:100%;max-height:70vh;box-shadow:var(--page-shadow)';
                    m.querySelector('[data-c]').replaceChildren(canvas);
                });
            };

            const renderSide = () => {
                const used = files.filter((f) => items.some((i) => i.file === f));
                ctx.side.innerHTML = `
                    <div class="side-block">
                        <div class="side-title">Documento</div>
                        <div class="stat-row"><span>Páginas</span><span>${items.length}</span></div>
                        ${used.map((f) => `<div class="stat-row"><span style="display:flex;align-items:center;gap:6px;min-width:0"><span class="src-dot" style="width:9px;height:9px;border-radius:50%;flex:none;background:${f.color}"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(f.name)}</span></span><span>${items.filter((i) => i.file === f).length}</span></div>`).join('')}
                    </div>
                    <div class="side-block">
                        <div class="side-title">Selección rápida</div>
                        <div class="field-row">
                            <button class="btn btn-sm" data-s="all">Todas</button>
                            <button class="btn btn-sm" data-s="odd">Impares</button>
                            <button class="btn btn-sm" data-s="even">Pares</button>
                        </div>
                        <div class="field-row" style="margin-top:8px">
                            <button class="btn btn-sm" data-s="none">Ninguna</button>
                            <button class="btn btn-sm" data-s="rev">${icon('rotateCcw')}Invertir orden</button>
                        </div>
                    </div>
                    <div class="side-block">
                        <div class="field"><label for="outName">Nombre del archivo</label><input class="input" id="outName" value="${UI.esc(outName)}"></div>
                    </div>`;
                ctx.side.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
                    const s = b.dataset.s;
                    if (s === 'all') selected = new Set(items.map((i) => i.uid));
                    if (s === 'none') selected.clear();
                    if (s === 'odd') selected = new Set(items.filter((_, i) => i % 2 === 0).map((i) => i.uid));
                    if (s === 'even') selected = new Set(items.filter((_, i) => i % 2 === 1).map((i) => i.uid));
                    if (s === 'rev') { snapshot(); items.reverse(); }
                    render();
                }));
                ctx.side.querySelector('#outName').addEventListener('input', (e) => { outName = e.target.value; });
                ctx.footer.innerHTML = '';
                const ex = UI.el(`<button class="btn" data-extract disabled></button>`);
                ex.addEventListener('click', () => save(items.filter((i) => selected.has(i.uid)), true));
                const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('download')}Guardar PDF</button>`);
                go.addEventListener('click', () => save(items, false));
                ctx.footer.append(ex, go);
                updateSel();
            };

            const save = (list, extract) => UI.task(extract ? 'Extrayendo páginas…' : 'Generando PDF…', async () => {
                const doc = await buildFromItems(list, (d, t) => UI.progress(d, t));
                const bytes = await Engine.save(doc);
                let name = (outName || 'organizado').trim().replace(/\.pdf$/i, '');
                name += extract ? '_extracto.pdf' : '.pdf';
                Comp.finish(ctx, {
                    out: { bytes, name },
                    title: extract ? '¡Páginas extraídas!' : '¡PDF guardado!',
                    sub: `<b>${UI.esc(name)}</b> · ${UI.plural(list.length, 'página', 'páginas')} · ${UI.formatBytes(bytes.length)}`,
                    onBack: render,
                });
            });

            const handoff = Tools.takeHandoff();
            render();
            if (handoff) addFiles(handoff);
        },
    });
})();

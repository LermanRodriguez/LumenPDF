/* Componentes reutilizables: estructura de herramienta, zona de soltar, resultados */
(function () {
    const Comp = {};

    /** Estructura estándar: cabecera + cuerpo + panel lateral */
    Comp.shell = (tool, { side = true } = {}) => {
        const root = UI.el(`<section class="tool-view" style="--c:${tool.color}">
            <div class="tool-main">
                <div class="tool-header">
                    <a class="back-btn" href="#/">${icon('arrowLeft')}Inicio</a>
                    <div class="tool-icon">${icon(tool.icon)}</div>
                    <div><h2>${UI.esc(tool.name)}</h2><p>${UI.esc(tool.desc)}</p></div>
                </div>
                <div class="tool-body"></div>
            </div>
            <aside class="tool-side">
                <div class="side-scroll"></div>
                <div class="side-footer"></div>
            </aside>
        </section>`);
        if (!side) {
            root.style.gridTemplateColumns = '1fr';
            root.querySelector('.tool-side').remove();
        }
        return {
            root,
            body: root.querySelector('.tool-body'),
            side: root.querySelector('.side-scroll'),
            footer: root.querySelector('.side-footer'),
            sideWrap: root.querySelector('.tool-side'),
        };
    };

    /** Zona grande para arrastrar o elegir archivos */
    Comp.dropzone = ({ title = 'Suelta tus PDFs aquí', sub = 'o haz clic para elegirlos', accept = 'application/pdf,.pdf', multiple = true, iconName = 'upload', color, button = 'Elegir archivos', onFiles }) => {
        const dz = UI.el(`<div class="dropzone" tabindex="0" role="button" ${color ? `style="--c:${color}"` : ''}>
            <div class="dz-icon">${icon(iconName)}</div>
            <h3>${UI.esc(title)}</h3>
            <p>${UI.esc(sub)}</p>
            <span class="btn btn-primary btn-lg">${icon('upload')}${UI.esc(button)}</span>
            <div class="dz-note">${icon('shield')}Tus archivos se procesan en este dispositivo y nunca se suben a internet.</div>
        </div>`);
        const pick = async () => { const f = await UI.pickFiles({ accept, multiple }); if (f.length) onFiles(f); };
        dz.addEventListener('click', pick);
        dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
        dz.addEventListener('drop', (e) => {
            e.preventDefault();
            e.lumenHandled = true; // la ventana no debe procesarlo otra vez (ver windowDrop)
            dz.classList.remove('drag');
            const files = [...e.dataTransfer.files];
            if (files.length) onFiles(multiple ? files : files.slice(0, 1));
        });
        return dz;
    };

    /**
     * Permite soltar archivos en cualquier parte de la ventana.
     * `isActive()` indica si ya hay trabajo abierto (si no, la zona central se encarga).
     * Devuelve una función para desactivarlo.
     */
    Comp.windowDrop = (label, onFiles, isActive = () => true) => {
        let overlay = null, depth = 0;
        const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
        const show = () => { if (!overlay) { overlay = UI.el(`<div class="page-drop-overlay">${UI.esc(label)}</div>`); document.body.appendChild(overlay); } };
        const hide = () => { overlay?.remove(); overlay = null; depth = 0; };
        const enter = (e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            depth++;
            if (isActive()) show();
        };
        const over = (e) => { if (hasFiles(e)) e.preventDefault(); };
        const leave = () => { if (--depth <= 0) hide(); };
        const drop = (e) => {
            hide(); // siempre se oculta, pase lo que pase con el archivo
            if (!hasFiles(e) || e.lumenHandled || !isActive()) return;
            e.preventDefault();
            const f = [...e.dataTransfer.files];
            if (f.length) onFiles(f);
        };
        window.addEventListener('dragenter', enter);
        window.addEventListener('dragover', over);
        window.addEventListener('dragleave', leave);
        window.addEventListener('drop', drop);
        window.addEventListener('dragend', hide);
        window.addEventListener('blur', hide);
        return () => {
            hide();
            window.removeEventListener('dragenter', enter);
            window.removeEventListener('dragover', over);
            window.removeEventListener('dragleave', leave);
            window.removeEventListener('drop', drop);
            window.removeEventListener('dragend', hide);
            window.removeEventListener('blur', hide);
        };
    };

    /** Tarjeta de resultado final con botones */
    Comp.result = ({ title = '¡Listo!', sub = '', extra = '', actions = [] }) => {
        const card = UI.el(`<div class="result-card">
            <div class="rc-icon">${icon('check')}</div>
            <h3>${UI.esc(title)}</h3>
            ${sub ? `<p>${sub}</p>` : ''}
            ${extra}
            <div class="result-actions"></div>
        </div>`);
        const bar = card.querySelector('.result-actions');
        actions.forEach((a) => {
            const b = UI.el(`<button type="button" class="btn ${a.primary ? 'btn-primary btn-lg' : 'btn-lg'}">${a.icon ? icon(a.icon) : ''}${UI.esc(a.label)}</button>`);
            b.addEventListener('click', a.onClick);
            bar.appendChild(b);
        });
        return card;
    };

    /**
     * Pantalla final estándar: descarga + continuar con otra herramienta.
     * out = { bytes, name } para un PDF, o { blob, name } para otro tipo (zip, imagen).
     */
    Comp.finish = (ctx, { out, title = '¡Listo!', sub = '', extra = '', onBack, backLabel = 'Volver a editar' }) => {
        const isPdf = !!out.bytes;
        const dl = () => (isPdf ? UI.download(out.bytes, out.name) : UI.download(out.blob, out.name));
        const actions = [{ label: 'Descargar', icon: 'download', primary: true, onClick: dl }];
        if (onBack) actions.push({ label: backLabel, icon: 'arrowLeft', onClick: () => { ctx.sideWrap && (ctx.sideWrap.hidden = false); onBack(); } });
        const card = Comp.result({
            title,
            sub: sub || `<b>${UI.esc(out.name)}</b> · ${UI.formatBytes(isPdf ? out.bytes.length : out.blob.size)}`,
            extra,
            actions,
        });
        if (isPdf) {
            const next = ['organizar', 'editar', 'comprimir', 'proteger', 'marca-agua', 'numerar'].filter((id) => id !== ctx.tool.id);
            const row = UI.el(`<div style="margin-top:26px"><div class="side-title">Continuar con este PDF</div><div class="result-actions"></div></div>`);
            next.forEach((id) => {
                const t = Tools.list.find((x) => x.id === id);
                if (!t) return;
                const b = UI.el(`<button type="button" class="btn btn-sm" style="--c:${t.color}"><span style="color:${t.color}">${icon(t.icon)}</span>${UI.esc(t.name)}</button>`);
                b.addEventListener('click', () => {
                    Tools.handoff = [new File([out.bytes], out.name, { type: 'application/pdf' })];
                    location.hash = '#/' + id;
                });
                row.querySelector('.result-actions').appendChild(b);
            });
            card.appendChild(row);
        }
        if (ctx.sideWrap) ctx.sideWrap.hidden = true;
        ctx.body.replaceChildren(card);
        Tools.dirty = false;
        dl();
    };

    /** Resumen de documento (miniatura + nombre + datos) */
    Comp.docSummary = (f, extraBtn) => {
        const el = UI.el(`<div class="doc-summary">
            <div class="ds-thumb"></div>
            <div class="ds-grow"><div class="ds-name">${UI.esc(f.name)}</div>
            <div class="ds-meta">${UI.plural(f.pageCount, 'página', 'páginas')} · ${UI.formatBytes(f.bytes.length)}${f.wasEncrypted ? ' · descifrado' : ''}</div></div>
        </div>`);
        el.querySelector('.ds-thumb').appendChild(Engine.lazyThumb(f, 0, 120));
        if (extraBtn) el.appendChild(extraBtn);
        return el;
    };

    /** Botón "cambiar archivo" */
    Comp.changeFileBtn = (onClick) => {
        const b = UI.el(`<button class="btn btn-sm" type="button">${icon('file')}Cambiar</button>`);
        b.addEventListener('click', onClick);
        return b;
    };

    Comp.infoBox = (html, warn = false) => `<div class="info-box ${warn ? 'warn' : ''}">${icon(warn ? 'alert' : 'info')}<div>${html}</div></div>`;

    /** Slider con valor visible */
    Comp.range = ({ id, min, max, step = 1, value, unit = '' }) =>
        `<div class="range-row"><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><span class="range-val" data-for="${id}">${value}${unit}</span></div>`;
    Comp.bindRanges = (root, units = {}) => {
        root.querySelectorAll('input[type="range"]').forEach((r) => {
            const lbl = root.querySelector(`.range-val[data-for="${r.id}"]`);
            if (lbl) r.addEventListener('input', () => { lbl.textContent = r.value + (units[r.id] || ''); });
        });
    };

    /** Carrusel de vista previa de una página grande con navegación */
    Comp.pagePreview = (f, { maxWidth = 520, onRender } = {}) => {
        const wrap = UI.el(`<div><div class="preview-stage"><div class="preview-page"><canvas></canvas><div class="wm-overlay"></div></div></div>
            <div class="preview-nav"><button class="btn btn-sm btn-icon" data-prev>${icon('chevronLeft')}</button><span data-lbl></span><button class="btn btn-sm btn-icon" data-next>${icon('chevronRight')}</button></div></div>`);
        const canvas = wrap.querySelector('canvas');
        const pageEl = wrap.querySelector('.preview-page');
        const overlay = wrap.querySelector('.wm-overlay');
        const lbl = wrap.querySelector('[data-lbl]');
        let idx = 0, token = 0;
        const state = { index: 0, scale: 1, width: 0, height: 0, overlay, canvas };
        const render = async () => {
            const my = ++token;
            const avail = Math.min(maxWidth, (wrap.parentElement?.clientWidth || maxWidth) - 8);
            const size = await Engine.pageSize(f, idx);
            const scale = Math.min(avail / size.width, 640 / size.height);
            const tmp = document.createElement('canvas');
            const { viewport } = await Engine.renderToCanvas(f, idx, { scale: scale * Math.min(devicePixelRatio || 1, 2), canvas: tmp });
            if (my !== token) return;
            canvas.width = tmp.width; canvas.height = tmp.height;
            canvas.getContext('2d').drawImage(tmp, 0, 0);
            const cssW = viewport.width / Math.min(devicePixelRatio || 1, 2), cssH = viewport.height / Math.min(devicePixelRatio || 1, 2);
            canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
            pageEl.style.width = cssW + 'px'; pageEl.style.height = cssH + 'px';
            Object.assign(state, { index: idx, scale, width: cssW, height: cssH, ptWidth: size.width, ptHeight: size.height });
            lbl.textContent = `Página ${idx + 1} de ${f.pageCount}`;
            onRender?.(state);
        };
        wrap.querySelector('[data-prev]').addEventListener('click', () => { if (idx > 0) { idx--; render(); } });
        wrap.querySelector('[data-next]').addEventListener('click', () => { if (idx < f.pageCount - 1) { idx++; render(); } });
        state.render = render;
        state.el = wrap;
        state.goTo = (i) => { idx = Math.max(0, Math.min(f.pageCount - 1, i)); render(); };
        setTimeout(render, 0);
        return state;
    };

    /** Selector de posición 3x3. value = 'tl','tc','tr','ml','mc','mr','bl','bc','br' */
    Comp.posGrid = (value, onChange, allowed) => {
        const keys = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
        const names = { tl: 'Arriba izquierda', tc: 'Arriba centro', tr: 'Arriba derecha', ml: 'Medio izquierda', mc: 'Centro', mr: 'Medio derecha', bl: 'Abajo izquierda', bc: 'Abajo centro', br: 'Abajo derecha' };
        const g = UI.el(`<div class="pos-grid">${keys.map((k) => `<button type="button" data-value="${k}" title="${names[k]}" aria-label="${names[k]}" aria-pressed="${k === value}" ${allowed && !allowed.includes(k) ? 'style="visibility:hidden"' : ''}></button>`).join('')}</div>`);
        UI.bindChoice(g, 'button', onChange);
        return g;
    };

    window.Comp = Comp;

    /** Registro de herramientas. Cada archivo de js/tools llama a Tools.register({...}) */
    window.Tools = {
        list: [],
        dirty: false,
        handoff: null, // archivos que pasan de una herramienta a otra ("Continuar con…")
        register(t) { this.list.push(t); },
        takeHandoff() { const h = this.handoff; this.handoff = null; return h; },
    };
})();

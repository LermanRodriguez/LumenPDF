/* Dividir PDF: cortes visuales con tijeras, cada N páginas o por rangos */
Tools.register({
    id: 'dividir',
    name: 'Dividir PDF',
    desc: 'Separa un PDF en varios archivos marcando dónde cortar.',
    icon: 'scissors',
    color: '#d68a00',
    section: 'organizar',
    mount(ctx) {
        let file = null;
        let mode = 'cuts'; // cuts | everyN | ranges | single
        let cuts = new Set(); // cortar DESPUÉS de la página i (índice base 0)
        let everyN = 2;
        let rangesText = '';
        let thumbSize = 130;
        const GROUP_COLORS = ['#e5484d', '#3b6fe0', '#2f9e5b', '#d68a00', '#8e4ec6', '#0894b3', '#d6409f', '#6e56cf', '#f76b15', '#12a594'];

        const load = async (list) => {
            if (list.length > 1) UI.toast('Se usará solo el primer PDF', 'info');
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            cuts = new Set();
            if (f.pageCount > 1) cuts.add(Math.floor(f.pageCount / 2) - 1); // sugerencia inicial: cortar a la mitad
            rangesText = f.pageCount > 1 ? `1-${Math.ceil(f.pageCount / 2)}, ${Math.ceil(f.pageCount / 2) + 1}-${f.pageCount}` : '1';
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        /** Calcula los grupos de páginas según el modo */
        const groups = () => {
            const n = file.pageCount;
            if (mode === 'single') return Array.from({ length: n }, (_, i) => [i]);
            if (mode === 'everyN') {
                const k = Math.max(1, everyN | 0);
                const g = [];
                for (let i = 0; i < n; i += k) g.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j));
                return g;
            }
            if (mode === 'ranges') return Engine.parseRanges(rangesText, n).groups;
            const g = [[]];
            for (let i = 0; i < n; i++) {
                g[g.length - 1].push(i);
                if (cuts.has(i) && i < n - 1) g.push([]);
            }
            return g;
        };

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres dividir', multiple: false, color: ctx.tool.color, iconName: 'scissors', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const wrap = UI.el(`<div>
                <div class="toolbar">
                    <span class="hint" data-hint></span>
                    <span class="spacer"></span>
                    <div class="zoom-ctl"><input type="range" min="80" max="240" value="${thumbSize}" data-zoom style="width:110px;accent-color:var(--accent)"></div>
                </div>
                <div class="split-flow"></div>
            </div>`);
            wrap.querySelector('[data-zoom]').addEventListener('input', (e) => {
                thumbSize = +e.target.value;
                wrap.querySelector('.split-flow').style.setProperty('--thumb', thumbSize + 'px');
            });
            wrap.querySelector('.split-flow').style.setProperty('--thumb', thumbSize + 'px');
            const flow = wrap.querySelector('.split-flow');
            for (let i = 0; i < file.pageCount; i++) {
                const p = UI.el(`<div class="split-page" data-i="${i}"><div class="thumb-wrap"></div><div class="page-label">${i + 1}</div></div>`);
                p.querySelector('.thumb-wrap').appendChild(Engine.lazyThumb(file, i, 220));
                flow.appendChild(p);
                if (i < file.pageCount - 1) {
                    const gap = UI.el(`<div class="split-gap" data-gap="${i}"><button type="button" title="Cortar aquí">${icon('scissors')}</button></div>`);
                    gap.querySelector('button').addEventListener('click', () => {
                        if (mode !== 'cuts') { mode = 'cuts'; cuts = cutsFromGroups(); }
                        cuts.has(i) ? cuts.delete(i) : cuts.add(i);
                        renderSide();
                        paint();
                    });
                    flow.appendChild(gap);
                }
            }
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), wrap);
            renderSide();
            paint();
        };

        /** Convierte los grupos actuales en cortes (para pasar a modo manual) */
        const cutsFromGroups = () => {
            const s = new Set();
            groups().forEach((g, k, all) => { if (k < all.length - 1) s.add(g[g.length - 1]); });
            return s;
        };

        /** Colorea páginas y tijeras según los grupos */
        const paint = () => {
            const gs = groups();
            const color = new Map();
            gs.forEach((g, k) => g.forEach((i) => { if (!color.has(i)) color.set(i, GROUP_COLORS[k % GROUP_COLORS.length]); }));
            ctx.body.querySelectorAll('.split-page').forEach((el) => {
                const i = +el.dataset.i;
                el.style.setProperty('--group-color', color.get(i) || 'transparent');
                el.classList.toggle('excluded', !color.has(i));
            });
            const contiguousCuts = mode === 'ranges' ? new Set() : cutsFromGroups();
            ctx.body.querySelectorAll('.split-gap').forEach((el) => el.classList.toggle('cut', contiguousCuts.has(+el.dataset.gap)));
            const hint = ctx.body.querySelector('[data-hint]');
            if (hint) hint.innerHTML = `${icon('scissors')}Haz clic en las tijeras entre páginas para cortar. Cada color es un archivo nuevo.`;
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Cómo dividir</div>
                    <div class="option-cards">
                        <button type="button" class="option-card" data-value="cuts" aria-pressed="${mode === 'cuts'}"><span class="oc-icon">${icon('scissors')}</span><span><strong>Cortes manuales</strong><span>Marca con las tijeras dónde cortar</span></span></button>
                        <button type="button" class="option-card" data-value="everyN" aria-pressed="${mode === 'everyN'}"><span class="oc-icon">${icon('everyN')}</span><span><strong>Cada N páginas</strong><span>Partes del mismo tamaño</span></span></button>
                        <button type="button" class="option-card" data-value="single" aria-pressed="${mode === 'single'}"><span class="oc-icon">${icon('dotsSplit')}</span><span><strong>Todas separadas</strong><span>Un archivo por página</span></span></button>
                        <button type="button" class="option-card" data-value="ranges" aria-pressed="${mode === 'ranges'}"><span class="oc-icon">${icon('ranges')}</span><span><strong>Por rangos</strong><span>Escribe rangos, ej. 1-3, 5, 8-10</span></span></button>
                    </div>
                </div>
                ${mode === 'everyN' ? `<div class="side-block"><div class="field"><label>Páginas por archivo</label>${Comp.range({ id: 'everyN', min: 1, max: Math.max(1, file.pageCount), value: everyN })}</div></div>` : ''}
                ${mode === 'ranges' ? `<div class="side-block"><div class="field"><label for="ranges">Rangos (cada uno es un archivo)</label><input class="input" id="ranges" value="${UI.esc(rangesText)}" placeholder="1-3, 4, 5-10"><span class="hint" data-rangehint></span></div></div>` : ''}
                <div class="side-block" data-result></div>`;
            UI.bindChoice(ctx.side, '.option-card', (v) => {
                if (v === 'cuts' && mode !== 'cuts') cuts = cutsFromGroups();
                mode = v;
                renderSide();
                paint();
            });
            const en = ctx.side.querySelector('#everyN');
            if (en) {
                Comp.bindRanges(ctx.side);
                en.addEventListener('input', () => { everyN = +en.value; updateResult(); paint(); });
            }
            const rg = ctx.side.querySelector('#ranges');
            if (rg) rg.addEventListener('input', UI.debounce(() => { rangesText = rg.value; updateResult(); paint(); }, 250));
            updateResult();
        };

        /** Actualiza la lista de archivos resultantes y el botón (sin redibujar los controles) */
        const updateResult = () => {
            const err = mode === 'ranges' ? Engine.parseRanges(rangesText, file.pageCount).error : null;
            const gs = err ? [] : groups();
            const rh = ctx.side.querySelector('[data-rangehint]');
            if (rh) {
                rh.textContent = err || 'Separados por comas. "8-" = de la 8 al final.';
                rh.style.color = err ? 'var(--accent)' : '';
            }
            ctx.side.querySelector('[data-result]').innerHTML = `
                <div class="side-title">Resultado: ${UI.plural(gs.length, 'archivo', 'archivos')}</div>
                <div class="groups-list">${gs.slice(0, 60).map((g, k) => `<div class="group-row"><span class="swatch" style="background:${GROUP_COLORS[k % GROUP_COLORS.length]}"></span><span class="gname">Parte ${k + 1}</span><span class="gpages">${g.length === 1 ? 'pág. ' + (g[0] + 1) : 'págs. ' + Engine.rangesToText(g)}</span></div>`).join('')}${gs.length > 60 ? `<div class="hint">…y ${gs.length - 60} más</div>` : ''}</div>`;
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg" ${!gs.length ? 'disabled' : ''}>${icon('scissors')}Dividir en ${UI.plural(gs.length, 'archivo', 'archivos')}</button>`);
            go.addEventListener('click', split);
            ctx.footer.appendChild(go);
        };

        const split = () => UI.task('Dividiendo…', async () => {
            const gs = groups();
            const src = await Engine.libDoc(file);
            const base = UI.baseName(file.name);
            const outs = [];
            for (let k = 0; k < gs.length; k++) {
                UI.progress(k, gs.length);
                const d = await Engine.newDoc();
                const pages = await d.copyPages(src, gs[k]);
                pages.forEach((p) => d.addPage(p));
                const label = gs[k].length === 1 ? `pag${gs[k][0] + 1}` : `pags${gs[k][0] + 1}-${gs[k][gs[k].length - 1] + 1}`;
                outs.push({ name: `${base}_parte${String(k + 1).padStart(String(gs.length).length, '0')}_${label}.pdf`, bytes: await Engine.save(d) });
            }
            if (outs.length === 1) {
                Comp.finish(ctx, { out: outs[0], title: '¡PDF dividido!', onBack: render });
                return;
            }
            UI.busyText('Creando ZIP…');
            const zip = new JSZip();
            outs.forEach((o) => zip.file(o.name, o.bytes));
            const blob = await zip.generateAsync({ type: 'blob' });
            const list = `<div class="groups-list" style="text-align:left;max-height:220px;overflow:auto;margin-bottom:20px">${outs.map((o, k) => `<div class="group-row"><span class="swatch" style="background:${GROUP_COLORS[k % GROUP_COLORS.length]}"></span><span class="gname" style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${UI.esc(o.name)}</span><button class="btn btn-sm btn-ghost" data-one="${k}" title="Descargar solo este">${icon('download')}</button></div>`).join('')}</div>`;
            Comp.finish(ctx, {
                out: { blob, name: `${base}_dividido.zip` },
                title: `¡${outs.length} archivos creados!`,
                sub: `Se descargan juntos en un ZIP (${UI.formatBytes(blob.size)}). También puedes bajarlos uno por uno:`,
                extra: list,
                onBack: render,
            });
            ctx.body.querySelectorAll('[data-one]').forEach((b) => b.addEventListener('click', () => UI.download(outs[+b.dataset.one].bytes, outs[+b.dataset.one].name)));
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

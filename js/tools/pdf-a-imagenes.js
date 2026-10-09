/* PDF a imágenes: elige páginas, formato y resolución */
Tools.register({
    id: 'pdf-a-imagenes',
    name: 'PDF a imágenes',
    desc: 'Convierte páginas del PDF en imágenes JPG o PNG.',
    icon: 'fileImage',
    color: '#6e56cf',
    section: 'convertir',
    mount(ctx) {
        let file = null;
        let selected = new Set();
        const o = { format: 'jpg', dpi: 150, quality: 90 };

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            selected = new Set([...Array(f.pageCount).keys()]);
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres convertir en imágenes', multiple: false, color: ctx.tool.color, iconName: 'fileImage', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const wrap = UI.el(`<div>
                <div class="toolbar">
                    <button class="btn btn-sm" data-s="all">${icon('selectAll')}Todas</button>
                    <button class="btn btn-sm" data-s="none">Ninguna</button>
                    <span class="spacer"></span>
                    <span class="hint" data-count></span>
                </div>
                <div class="page-grid selecting" style="--thumb:140px"></div>
            </div>`);
            const grid = wrap.querySelector('.page-grid');
            for (let i = 0; i < file.pageCount; i++) {
                const el = UI.el(`<div class="page-item ${selected.has(i) ? 'selected' : ''}" style="cursor:pointer"><div class="page-check"></div><div class="thumb-wrap"></div><div class="page-label">${i + 1}</div></div>`);
                el.querySelector('.thumb-wrap').appendChild(Engine.lazyThumb(file, i, 220));
                el.addEventListener('click', () => {
                    selected.has(i) ? selected.delete(i) : selected.add(i);
                    el.classList.toggle('selected', selected.has(i));
                    count();
                });
                grid.appendChild(el);
            }
            const count = () => {
                wrap.querySelector('[data-count]').textContent = `${selected.size} de ${file.pageCount} páginas seleccionadas`;
                const b = ctx.footer.querySelector('button');
                if (b) { b.disabled = !selected.size; b.innerHTML = `${icon('download')}Convertir ${UI.plural(selected.size, 'página', 'páginas')}`; }
            };
            wrap.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
                selected = b.dataset.s === 'all' ? new Set([...Array(file.pageCount).keys()]) : new Set();
                grid.querySelectorAll('.page-item').forEach((el, i) => el.classList.toggle('selected', selected.has(i)));
                count();
            }));
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), wrap);
            renderSide();
            count();
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Formato</div>
                    <div class="option-cards">
                        <button type="button" class="option-card" data-g="fmt" data-value="jpg" aria-pressed="${o.format === 'jpg'}"><span class="oc-icon">${icon('image')}</span><span><strong>JPG</strong><span>Archivos ligeros, ideal para fotos</span></span></button>
                        <button type="button" class="option-card" data-g="fmt" data-value="png" aria-pressed="${o.format === 'png'}"><span class="oc-icon">${icon('fileImage')}</span><span><strong>PNG</strong><span>Máxima nitidez para texto y gráficos</span></span></button>
                    </div>
                </div>
                <div class="side-block">
                    <div class="side-title">Resolución</div>
                    <div class="segmented" data-seg="dpi">${[[72, 'Pantalla'], [150, 'Normal'], [300, 'Impresión']].map(([d, l]) => `<button type="button" data-value="${d}" aria-pressed="${d === o.dpi}"><b>${d} ppp</b><span style="font-weight:400;font-size:11px">${l}</span></button>`).join('')}</div>
                </div>
                <div class="side-block" data-q ${o.format === 'png' ? 'hidden' : ''}>
                    <div class="field"><label>Calidad JPG</label>${Comp.range({ id: 'iQ', min: 40, max: 100, value: o.quality, unit: '%' })}</div>
                </div>`;
            UI.bindChoice(ctx.side, '[data-g="fmt"]', (v) => { o.format = v; ctx.side.querySelector('[data-q]').hidden = v === 'png'; });
            UI.bindChoice(ctx.side.querySelector('[data-seg="dpi"]'), 'button', (v) => { o.dpi = +v; });
            Comp.bindRanges(ctx.side, { iQ: '%' });
            ctx.side.querySelector('#iQ').addEventListener('input', (e) => { o.quality = +e.target.value; });
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg"></button>`);
            go.addEventListener('click', convert);
            ctx.footer.appendChild(go);
        };

        const convert = () => UI.task('Convirtiendo…', async () => {
            const list = [...selected].sort((a, b) => a - b);
            const base = UI.baseName(file.name);
            const mime = o.format === 'jpg' ? 'image/jpeg' : 'image/png';
            const outs = [];
            for (let k = 0; k < list.length; k++) {
                UI.busyText(`Página ${list[k] + 1} (${k + 1} de ${list.length})…`);
                UI.progress(k, list.length);
                const { canvas } = await Engine.renderForExport(file, list[k], o.dpi / 72);
                const blob = await new Promise((r) => canvas.toBlob(r, mime, o.quality / 100));
                canvas.width = canvas.height = 0;
                outs.push({ name: `${base}_pagina${String(list[k] + 1).padStart(String(file.pageCount).length, '0')}.${o.format}`, blob });
            }
            if (outs.length === 1) {
                const url = URL.createObjectURL(outs[0].blob);
                Comp.finish(ctx, { out: outs[0], title: '¡Imagen lista!', extra: `<img src="${url}" style="max-width:100%;max-height:320px;box-shadow:var(--page-shadow);margin-bottom:20px">`, onBack: render });
                return;
            }
            UI.busyText('Creando ZIP…');
            const zip = new JSZip();
            outs.forEach((x) => zip.file(x.name, x.blob));
            const blob = await zip.generateAsync({ type: 'blob' });
            Comp.finish(ctx, {
                out: { blob, name: `${base}_imagenes.zip` },
                title: `¡${outs.length} imágenes listas!`,
                sub: `Descargadas en un ZIP · ${UI.formatBytes(blob.size)}`,
                onBack: render,
            });
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

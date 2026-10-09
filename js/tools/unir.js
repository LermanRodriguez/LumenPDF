/* Unir PDFs: tarjetas arrastrables con miniatura, orden visual */
Tools.register({
    id: 'unir',
    name: 'Unir PDF',
    desc: 'Combina varios PDFs en uno. Arrástralos para elegir el orden.',
    icon: 'merge',
    color: '#e5484d',
    section: 'organizar',
    mount(ctx) {
        let files = [];
        let blankBetween = false;
        let outName = 'unido.pdf';

        const addFiles = async (list) => {
            const loaded = await Engine.loadMany(list);
            if (!loaded.length) return;
            files.push(...loaded);
            if (files.length === loaded.length && files.length) outName = UI.baseName(files[0].name) + '_unido.pdf';
            Tools.dirty = true;
            render();
        };

        const disposeDrop = Comp.windowDrop('Suelta para añadir PDFs', (f) => addFiles(f), () => files.length > 0);
        ctx.onCleanup(disposeDrop);
        ctx.onCleanup(() => { Tools.dirty = false; });

        const render = () => {
            ctx.sideWrap.hidden = !files.length;
            if (!files.length) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta aquí los PDFs que quieres unir', sub: 'Puedes elegir varios a la vez', color: ctx.tool.color, iconName: 'merge', onFiles: addFiles }));
                return;
            }
            const totalPages = files.reduce((s, f) => s + f.pageCount, 0);
            const wrap = UI.el(`<div>
                <div class="toolbar">
                    <button class="btn" data-add>${icon('plus')}Añadir PDFs</button>
                    <div class="toolbar-group">
                        <button class="btn btn-sm btn-ghost" data-sort="az" title="Ordenar por nombre A→Z">A→Z</button>
                        <button class="btn btn-sm btn-ghost" data-sort="za" title="Ordenar por nombre Z→A">Z→A</button>
                        <button class="btn btn-sm btn-ghost" data-sort="rev" title="Invertir orden">${icon('rotateCcw')}Invertir</button>
                    </div>
                    <span class="spacer"></span>
                    <span class="hint">${icon('move', 'inline')} Arrastra las tarjetas para cambiar el orden</span>
                </div>
                <div class="file-grid"></div>
            </div>`);
            const grid = wrap.querySelector('.file-grid');
            files.forEach((f, i) => {
                const card = UI.el(`<div class="file-card" data-id="${f.id}">
                    <div class="file-order">${i + 1}</div>
                    <div class="page-actions">
                        <button type="button" data-act="dup" title="Duplicar">${icon('copy')}</button>
                        <button type="button" data-act="del" title="Quitar">${icon('trash')}</button>
                    </div>
                    <div class="thumb-wrap"><div class="file-stack ${f.pageCount > 1 ? 'multi' : ''}"></div></div>
                    <div>
                        <div class="file-name" title="${UI.esc(f.name)}"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${f.color};margin-right:6px"></span>${UI.esc(f.name)}</div>
                        <div class="file-meta"><span>${UI.plural(f.pageCount, 'página', 'páginas')}</span><span>${UI.formatBytes(f.bytes.length)}</span></div>
                    </div>
                </div>`);
                card.querySelector('.file-stack').appendChild(Engine.lazyThumb(f, 0, 220));
                card.querySelector('[data-act="del"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    files = files.filter((x) => x !== f);
                    render();
                });
                card.querySelector('[data-act="dup"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    files.splice(files.indexOf(f) + 1, 0, f);
                    render();
                });
                grid.appendChild(card);
            });
            const add = UI.el(`<button type="button" class="add-card">${icon('plus')}Añadir más</button>`);
            add.addEventListener('click', async () => addFiles(await UI.pickFiles()));
            grid.appendChild(add);

            Sortable.create(grid, {
                animation: 180,
                draggable: '.file-card',
                filter: '.page-actions',
                preventOnFilter: false,
                onEnd: () => {
                    const cards = [...grid.querySelectorAll('.file-card')];
                    // reconstruye el orden respetando duplicados (misma id varias veces)
                    const pool = [...files];
                    files = cards.map((c) => {
                        const k = pool.findIndex((x) => String(x.id) === c.dataset.id);
                        return pool.splice(k, 1)[0];
                    });
                    cards.forEach((c, i) => { c.querySelector('.file-order').textContent = i + 1; });
                },
            });

            wrap.querySelector('[data-add]').addEventListener('click', async () => addFiles(await UI.pickFiles()));
            wrap.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
                const m = b.dataset.sort;
                const coll = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
                if (m === 'az') files.sort((a, c) => coll.compare(a.name, c.name));
                if (m === 'za') files.sort((a, c) => coll.compare(c.name, a.name));
                if (m === 'rev') files.reverse();
                render();
            }));
            ctx.body.replaceChildren(wrap);

            // Panel lateral
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Resumen</div>
                    <div class="stat-row"><span>Archivos</span><span>${files.length}</span></div>
                    <div class="stat-row"><span>Páginas en total</span><span>${totalPages}</span></div>
                    <div class="stat-row"><span>Tamaño aproximado</span><span>${UI.formatBytes(files.reduce((s, f) => s + f.bytes.length, 0))}</span></div>
                </div>
                <div class="side-block">
                    <div class="side-title">Opciones</div>
                    <label class="check"><input type="checkbox" id="blankBetween" ${blankBetween ? 'checked' : ''}>Página en blanco tras documentos con páginas impares</label>
                    <p class="hint" style="margin:4px 0 0 26px">Útil para imprimir a doble cara: cada documento empieza en hoja nueva.</p>
                </div>
                <div class="side-block">
                    <div class="field"><label for="outName">Nombre del archivo</label><input class="input" id="outName" value="${UI.esc(outName)}"></div>
                </div>`;
            ctx.side.querySelector('#blankBetween').addEventListener('change', (e) => { blankBetween = e.target.checked; });
            ctx.side.querySelector('#outName').addEventListener('input', (e) => { outName = e.target.value; });
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg" ${files.length < 2 ? 'disabled' : ''}>${icon('merge')}Unir ${files.length} PDFs</button>`);
            if (files.length < 2) ctx.footer.appendChild(UI.el(`<span class="hint" style="text-align:center">Añade al menos 2 PDFs</span>`));
            go.addEventListener('click', merge);
            ctx.footer.appendChild(go);
        };

        const merge = () => UI.task('Uniendo PDFs…', async () => {
            const out = await Engine.newDoc();
            for (let i = 0; i < files.length; i++) {
                UI.progress(i, files.length);
                const src = await Engine.libDoc(files[i]);
                const pages = await out.copyPages(src, src.getPageIndices());
                pages.forEach((p) => out.addPage(p));
                if (blankBetween && pages.length % 2 === 1 && i < files.length - 1) {
                    const { width, height } = pages[pages.length - 1].getSize();
                    out.addPage([width, height]);
                }
            }
            UI.progress(files.length, files.length);
            const bytes = await Engine.save(out);
            let name = (outName || 'unido').trim();
            if (!/\.pdf$/i.test(name)) name += '.pdf';
            Comp.finish(ctx, {
                out: { bytes, name },
                title: '¡PDFs unidos!',
                sub: `${UI.plural(files.length, 'archivo', 'archivos')} → <b>${UI.esc(name)}</b> · ${UI.plural(out.getPageCount(), 'página', 'páginas')} · ${UI.formatBytes(bytes.length)}`,
                onBack: render,
            });
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) addFiles(handoff);
    },
});

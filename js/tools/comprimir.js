/* Comprimir: optimización sin pérdida (qpdf) o compresión fuerte convirtiendo páginas a imagen */
Tools.register({
    id: 'comprimir',
    name: 'Comprimir PDF',
    desc: 'Reduce el tamaño del archivo. Compara el antes y el después.',
    icon: 'compress',
    color: '#f76b15',
    section: 'convertir',
    mount(ctx) {
        let file = null;
        let level = 'medium';
        const LEVELS = {
            low: { name: 'Sin pérdida', desc: 'Reorganiza y recomprime. Calidad idéntica, texto intacto.', icon: 'check' },
            medium: { name: 'Recomendada', desc: 'Páginas a imagen de buena calidad (150 ppp). Mucho más ligero.', icon: 'sparkle', dpi: 150, q: 0.72 },
            high: { name: 'Máxima', desc: 'Imagen a 96 ppp, calidad media. Lo más pequeño posible.', icon: 'compress', dpi: 96, q: 0.55 },
        };

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres comprimir', multiple: false, color: ctx.tool.color, iconName: 'compress', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const grid = UI.el('<div class="page-grid" style="--thumb:120px"></div>');
            for (let i = 0; i < Math.min(file.pageCount, 24); i++) {
                const it = UI.el(`<div class="page-item" style="cursor:default"><div class="thumb-wrap"></div><div class="page-label">${i + 1}</div></div>`);
                it.querySelector('.thumb-wrap').appendChild(Engine.lazyThumb(file, i, 200));
                grid.appendChild(it);
            }
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), grid);
            if (file.pageCount > 24) ctx.body.appendChild(UI.el(`<p class="hint" style="text-align:center">…y ${file.pageCount - 24} páginas más</p>`));
            renderSide();
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Nivel de compresión</div>
                    <div class="option-cards">${Object.entries(LEVELS).map(([k, l]) => `<button type="button" class="option-card" data-value="${k}" aria-pressed="${k === level}"><span class="oc-icon">${icon(l.icon)}</span><span><strong>${l.name}</strong><span>${l.desc}</span></span></button>`).join('')}</div>
                </div>
                <div class="side-block" data-warn></div>
                <div class="side-block">
                    <div class="stat-row"><span>Tamaño actual</span><span>${UI.formatBytes(file.bytes.length)}</span></div>
                    <div class="stat-row"><span>Páginas</span><span>${file.pageCount}</span></div>
                </div>`;
            const warn = () => {
                ctx.side.querySelector('[data-warn]').innerHTML = level === 'low'
                    ? Comp.infoBox('Ideal para documentos de texto. Si el PDF tiene muchas fotos, prueba "Recomendada".')
                    : Comp.infoBox('Las páginas se convierten en imágenes: el texto dejará de ser seleccionable y los enlaces/formularios se pierden. Ideal para documentos escaneados.', true);
            };
            UI.bindChoice(ctx.side, '.option-card', (v) => { level = v; warn(); });
            warn();
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('compress')}Comprimir PDF</button>`);
            go.addEventListener('click', compress);
            ctx.footer.appendChild(go);
        };

        const compress = () => UI.task('Comprimiendo…', async () => {
            const before = file.bytes.length;
            let bytes;
            if (level === 'low') {
                UI.busyText('Optimizando estructura…');
                // primero se reescribe con pdf-lib (object streams) y luego qpdf recomprime
                const rewritten = await Engine.save(await Engine.freshDoc(file));
                bytes = await Engine.optimize(rewritten);
            } else {
                const { dpi, q } = LEVELS[level];
                const out = await Engine.newDoc();
                for (let i = 0; i < file.pageCount; i++) {
                    UI.busyText(`Procesando página ${i + 1} de ${file.pageCount}…`);
                    UI.progress(i, file.pageCount);
                    const { canvas, ptWidth, ptHeight } = await Engine.renderForExport(file, i, dpi / 72);
                    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
                    const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
                    const page = out.addPage([ptWidth, ptHeight]);
                    page.drawImage(jpg, { x: 0, y: 0, width: ptWidth, height: ptHeight });
                    canvas.width = canvas.height = 0; // libera memoria
                }
                bytes = await Engine.save(out);
            }
            const after = bytes.length;
            const saved = before - after;
            const name = UI.baseName(file.name) + '_comprimido.pdf';
            if (saved <= 0) {
                ctx.sideWrap.hidden = true;
                ctx.body.replaceChildren(Comp.result({
                    title: 'Este PDF ya está muy optimizado',
                    sub: `Con el nivel "${LEVELS[level].name}" quedaría en ${UI.formatBytes(after)} (original: ${UI.formatBytes(before)}). Te recomendamos conservar el original${level === 'low' ? ' o probar un nivel más fuerte' : ''}.`,
                    actions: [
                        { label: 'Probar otro nivel', icon: 'arrowLeft', primary: true, onClick: () => { ctx.sideWrap.hidden = false; render(); } },
                        { label: 'Descargar de todos modos', icon: 'download', onClick: () => UI.download(bytes, name) },
                    ],
                }));
                ctx.body.querySelector('.rc-icon').innerHTML = icon('info');
                return;
            }
            const pct = Math.round((saved / before) * 100);
            Comp.finish(ctx, {
                out: { bytes, name },
                title: `¡${pct}% más ligero!`,
                sub: `<b>${UI.esc(name)}</b>`,
                extra: `<div class="size-compare">
                        <div class="size-box"><div class="sb-label">Antes</div><div class="sb-val">${UI.formatBytes(before)}</div></div>
                        <div style="font-size:24px;color:var(--text-3)">→</div>
                        <div class="size-box"><div class="sb-label">Después</div><div class="sb-val" style="color:var(--ok)">${UI.formatBytes(after)}</div></div>
                    </div>
                    <div class="bar-compare"><div style="width:100%"></div></div>
                    <p class="size-saving">Ahorraste ${UI.formatBytes(saved)}</p>`,
                onBack: render,
            });
            const bar = ctx.body.querySelector('.bar-compare div');
            setTimeout(() => { bar.style.width = Math.max(2, 100 - pct) + '%'; }, 60);
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

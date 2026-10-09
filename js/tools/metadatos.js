/* Metadatos: ver y editar título, autor, etc., o borrarlos todos */
Tools.register({
    id: 'metadatos',
    name: 'Propiedades y metadatos',
    desc: 'Consulta y edita título, autor y palabras clave, o bórralos para más privacidad.',
    icon: 'tag',
    color: '#3b6fe0',
    section: 'seguridad',
    mount(ctx) {
        let file = null;
        let meta = {};
        let info = {};

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            const d = await Engine.freshDoc(f);
            const fmt = (dt) => (dt ? dt.toLocaleString('es') : '—');
            meta = { title: d.getTitle() || '', author: d.getAuthor() || '', subject: d.getSubject() || '', keywords: d.getKeywords() || '', creator: d.getCreator() || '', producer: d.getProducer() || '' };
            const header = new TextDecoder('latin1').decode(f.bytes.subarray(0, 16)).match(/%PDF-(\d\.\d)/);
            const s = await Engine.pageSize(f, 0);
            info = {
                version: header ? header[1] : '—',
                created: fmt(d.getCreationDate()),
                modified: fmt(d.getModificationDate()),
                size: `${Math.round(s.width / 72 * 25.4)} × ${Math.round(s.height / 72 * 25.4)} mm`,
                xmp: !!d.catalog.get(PDFLib.PDFName.of('Metadata')),
            };
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        const FIELDS = [['title', 'Título'], ['author', 'Autor'], ['subject', 'Asunto'], ['keywords', 'Palabras clave'], ['creator', 'Aplicación de origen'], ['producer', 'Productor PDF']];

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta un PDF para ver sus propiedades', multiple: false, color: ctx.tool.color, iconName: 'tag', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const form = UI.el(`<div class="center-col" style="max-width:640px">
                ${FIELDS.map(([k, l]) => `<div class="field"><label for="m_${k}">${l}</label>${k === 'keywords' || k === 'subject' ? `<textarea class="input" id="m_${k}" rows="2">${UI.esc(meta[k])}</textarea>` : `<input class="input" id="m_${k}" value="${UI.esc(meta[k])}">`}</div>`).join('')}
            </div>`);
            FIELDS.forEach(([k]) => form.querySelector('#m_' + k).addEventListener('input', (e) => { meta[k] = e.target.value; }));
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), form);
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Información</div>
                    <div class="stat-row"><span>Versión PDF</span><span>${info.version}</span></div>
                    <div class="stat-row"><span>Páginas</span><span>${file.pageCount}</span></div>
                    <div class="stat-row"><span>Tamaño de página</span><span>${info.size}</span></div>
                    <div class="stat-row"><span>Tamaño de archivo</span><span>${UI.formatBytes(file.bytes.length)}</span></div>
                    <div class="stat-row"><span>Creado</span><span>${UI.esc(info.created)}</span></div>
                    <div class="stat-row"><span>Modificado</span><span>${UI.esc(info.modified)}</span></div>
                    <div class="stat-row"><span>Metadatos XMP</span><span>${info.xmp ? 'Sí' : 'No'}</span></div>
                </div>
                <div class="side-block">
                    ${Comp.infoBox('Los metadatos pueden revelar tu nombre, el programa que usaste o fechas. Bórralos antes de compartir si quieres más privacidad.')}
                </div>`;
            ctx.footer.innerHTML = '';
            const wipe = UI.el(`<button class="btn">${icon('trash')}Borrar todos los metadatos</button>`);
            wipe.addEventListener('click', () => save(true));
            const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('download')}Guardar cambios</button>`);
            go.addEventListener('click', () => save(false));
            ctx.footer.append(wipe, go);
        };

        const save = (wipe) => UI.task('Guardando…', async () => {
            const d = await Engine.freshDoc(file);
            if (wipe) {
                // elimina el diccionario Info y el flujo XMP
                d.catalog.delete(PDFLib.PDFName.of('Metadata'));
                const infoRef = d.context.trailerInfo.Info;
                if (infoRef) d.context.delete(infoRef);
                d.context.trailerInfo.Info = undefined;
            } else {
                d.setTitle(meta.title);
                d.setAuthor(meta.author);
                d.setSubject(meta.subject);
                d.setKeywords(meta.keywords.split(/[,;]\s*/).filter(Boolean));
                d.setCreator(meta.creator);
                d.setProducer(meta.producer);
                d.setModificationDate(new Date());
            }
            const bytes = await d.save({ useObjectStreams: true, updateFieldAppearances: false });
            Comp.finish(ctx, {
                out: { bytes, name: UI.baseName(file.name) + (wipe ? '_sin_metadatos.pdf' : '_propiedades.pdf') },
                title: wipe ? '¡Metadatos eliminados!' : '¡Propiedades guardadas!',
                onBack: render,
            });
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

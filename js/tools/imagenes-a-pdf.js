/* Imágenes a PDF: fotos/escaneos ordenables con tamaño de página y márgenes */
Tools.register({
    id: 'imagenes-a-pdf',
    name: 'Imágenes a PDF',
    desc: 'Convierte fotos JPG, PNG o WEBP en un PDF. Ordénalas arrastrando.',
    icon: 'images',
    color: '#d6409f',
    section: 'convertir',
    mount(ctx) {
        let imgs = []; // { id, file, url, rotation }
        let seq = 0;
        const o = { size: 'a4', orient: 'auto', margin: 'small', name: 'imagenes.pdf' };
        const SIZES = { a4: ['A4', [595.28, 841.89]], letter: ['Carta', [612, 792]], legal: ['Oficio', [612, 1008]], fit: ['Igual a la imagen', null] };
        const MARGINS = { none: ['Sin margen', 0], small: ['Pequeño', 20], big: ['Grande', 50] };
        const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp';

        const add = (list) => {
            const ok = list.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name));
            if (ok.length < list.length) UI.toast(`Se ignoraron ${list.length - ok.length} archivo(s) que no son imágenes`, 'warn');
            if (!ok.length) return;
            if (!imgs.length) o.name = UI.baseName(ok[0].name) + '.pdf';
            ok.forEach((f) => imgs.push({ id: ++seq, file: f, url: URL.createObjectURL(f), rotation: 0 }));
            Tools.dirty = true;
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para añadir imágenes', add, () => imgs.length > 0));
        ctx.onCleanup(() => { imgs.forEach((i) => URL.revokeObjectURL(i.url)); Tools.dirty = false; });

        const render = () => {
            ctx.sideWrap.hidden = !imgs.length;
            if (!imgs.length) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta aquí tus imágenes', sub: 'JPG, PNG, WEBP, GIF o BMP · puedes elegir varias', accept: ACCEPT, color: ctx.tool.color, iconName: 'images', button: 'Elegir imágenes', onFiles: add }));
                return;
            }
            const wrap = UI.el(`<div>
                <div class="toolbar">
                    <button class="btn" data-add>${icon('plus')}Añadir imágenes</button>
                    <span class="spacer"></span>
                    <span class="hint">${icon('move')}Arrastra para ordenar · cada imagen será una página</span>
                </div>
                <div class="page-grid" style="--thumb:160px"></div>
            </div>`);
            const grid = wrap.querySelector('.page-grid');
            imgs.forEach((im, i) => {
                const el = UI.el(`<div class="page-item" data-id="${im.id}">
                    <div class="page-actions">
                        <button type="button" data-a="rot" title="Girar">${icon('rotateCw')}</button>
                        <button type="button" data-a="del" title="Quitar">${icon('trash')}</button>
                    </div>
                    <div class="thumb-wrap"><img class="thumb" alt="" draggable="false" style="object-fit:contain"></div>
                    <div class="page-label"><span data-num>${i + 1}</span> · <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px">${UI.esc(im.file.name)}</span></div>
                </div>`);
                const img = el.querySelector('img');
                img.src = im.url;
                const rot = () => {
                    const wrapEl = el.querySelector('.thumb-wrap');
                    let k = 1;
                    if (im.rotation % 180) k = Math.min(1, wrapEl.clientWidth / (img.offsetHeight || 1), wrapEl.clientHeight / (img.offsetWidth || 1));
                    img.style.transform = `rotate(${im.rotation}deg) scale(${k})`;
                };
                img.addEventListener('load', rot);
                el.querySelector('[data-a="rot"]').addEventListener('click', (e) => { e.stopPropagation(); im.rotation = (im.rotation + 90) % 360; rot(); });
                el.querySelector('[data-a="del"]').addEventListener('click', (e) => { e.stopPropagation(); URL.revokeObjectURL(im.url); imgs = imgs.filter((x) => x !== im); render(); });
                grid.appendChild(el);
            });
            Sortable.create(grid, {
                animation: 160,
                filter: '.page-actions',
                preventOnFilter: false,
                onEnd: (e) => {
                    const [m] = imgs.splice(e.oldIndex, 1);
                    imgs.splice(e.newIndex, 0, m);
                    grid.querySelectorAll('[data-num]').forEach((n, i) => { n.textContent = i + 1; });
                },
            });
            wrap.querySelector('[data-add]').addEventListener('click', async () => add(await UI.pickFiles({ accept: ACCEPT })));
            ctx.body.replaceChildren(wrap);
            renderSide();
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Tamaño de página</div>
                    <div class="option-cards">${Object.entries(SIZES).map(([k, [l]]) => `<button type="button" class="option-card" data-g="size" data-value="${k}" aria-pressed="${k === o.size}" style="padding:9px 12px"><span><strong>${l}</strong></span></button>`).join('')}</div>
                </div>
                <div class="side-block" ${o.size === 'fit' ? 'hidden' : ''} data-orient>
                    <div class="side-title">Orientación</div>
                    <div class="segmented" data-seg="orient">
                        <button type="button" data-value="auto" aria-pressed="${o.orient === 'auto'}">${icon('sparkle')}Auto</button>
                        <button type="button" data-value="portrait" aria-pressed="${o.orient === 'portrait'}">${icon('portrait')}Vertical</button>
                        <button type="button" data-value="landscape" aria-pressed="${o.orient === 'landscape'}">${icon('landscape')}Horizontal</button>
                    </div>
                </div>
                <div class="side-block">
                    <div class="side-title">Margen</div>
                    <div class="segmented" data-seg="margin">${Object.entries(MARGINS).map(([k, [l]]) => `<button type="button" data-value="${k}" aria-pressed="${k === o.margin}">${l}</button>`).join('')}</div>
                </div>
                <div class="side-block">
                    <div class="field"><label for="iName">Nombre del archivo</label><input class="input" id="iName" value="${UI.esc(o.name)}"></div>
                </div>`;
            UI.bindChoice(ctx.side, '[data-g="size"]', (v) => { o.size = v; ctx.side.querySelector('[data-orient]').hidden = v === 'fit'; });
            UI.bindChoice(ctx.side.querySelector('[data-seg="orient"]'), 'button', (v) => { o.orient = v; });
            UI.bindChoice(ctx.side.querySelector('[data-seg="margin"]'), 'button', (v) => { o.margin = v; });
            ctx.side.querySelector('#iName').addEventListener('input', (e) => { o.name = e.target.value; });
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('fileImage')}Crear PDF (${UI.plural(imgs.length, 'imagen', 'imágenes')})</button>`);
            go.addEventListener('click', build);
            ctx.footer.appendChild(go);
        };

        /** Gira una imagen preparada con canvas */
        const rotateImage = async (prep, deg) => {
            const bmp = await createImageBitmap(new Blob([prep.bytes]));
            const c = document.createElement('canvas');
            const swap = deg % 180 !== 0;
            c.width = swap ? bmp.height : bmp.width;
            c.height = swap ? bmp.width : bmp.height;
            const g = c.getContext('2d');
            g.translate(c.width / 2, c.height / 2);
            g.rotate((deg * Math.PI) / 180);
            g.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
            bmp.close();
            const type = prep.type;
            const blob = await new Promise((r) => c.toBlob(r, type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
            return { bytes: new Uint8Array(await blob.arrayBuffer()), type, width: c.width, height: c.height };
        };

        const build = () => UI.task('Creando PDF…', async () => {
            const doc = await Engine.newDoc();
            const margin = MARGINS[o.margin][1];
            for (let i = 0; i < imgs.length; i++) {
                UI.progress(i, imgs.length);
                let prep = await Engine.prepareImage(imgs[i].file);
                if (imgs[i].rotation) prep = await rotateImage(prep, imgs[i].rotation);
                const emb = await Engine.embedImage(doc, prep);
                let pw, ph;
                if (o.size === 'fit') {
                    // 1 píxel = 0.75 pt (96 ppp), con el margen alrededor
                    pw = prep.width * 0.75 + margin * 2;
                    ph = prep.height * 0.75 + margin * 2;
                } else {
                    [pw, ph] = SIZES[o.size][1];
                    const land = o.orient === 'landscape' || (o.orient === 'auto' && prep.width > prep.height);
                    if (land) [pw, ph] = [ph, pw];
                }
                const page = doc.addPage([pw, ph]);
                const aw = pw - margin * 2, ah = ph - margin * 2;
                const k = Math.min(aw / prep.width, ah / prep.height);
                const w = prep.width * k, h = prep.height * k;
                page.drawImage(emb, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
            }
            const bytes = await Engine.save(doc);
            let name = (o.name || 'imagenes').trim();
            if (!/\.pdf$/i.test(name)) name += '.pdf';
            Comp.finish(ctx, {
                out: { bytes, name },
                title: '¡PDF creado!',
                sub: `<b>${UI.esc(name)}</b> · ${UI.plural(imgs.length, 'página', 'páginas')} · ${UI.formatBytes(bytes.length)}`,
                onBack: render,
            });
        });

        render();
    },
});

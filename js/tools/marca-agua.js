/* Marca de agua: texto o imagen, centrada o en mosaico, con vista previa en vivo */
Tools.register({
    id: 'marca-agua',
    name: 'Marca de agua',
    desc: 'Estampa un texto o un logo sobre las páginas, con vista previa.',
    icon: 'droplet',
    color: '#0894b3',
    section: 'editar',
    mount(ctx) {
        let file = null;
        let preview = null;
        const o = {
            type: 'text', text: 'CONFIDENCIAL', font: 'HelveticaBold', size: 60, color: '#e5484d', opacity: 30,
            angle: 45, layout: 'center', pages: 'all', range: '', behind: false,
            image: null, imgScale: 40,
        };
        const FONTS = { HelveticaBold: ['Helvetica Negrita', 'bold {s}px Helvetica, Arial, sans-serif'], Helvetica: ['Helvetica', '{s}px Helvetica, Arial, sans-serif'], TimesRomanBold: ['Times Negrita', "bold {s}px 'Times New Roman', serif"], CourierBold: ['Courier Negrita', "bold {s}px 'Courier New', monospace"] };
        const COLORS = ['#e5484d', '#111111', '#7a7a7a', '#1b4fd8', '#2f9e5b', '#d68a00'];

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        /** Posiciones (centros) de la marca en coordenadas visuales */
        const positions = (W, H, itemW, itemH) => {
            if (o.layout === 'center') return [[W / 2, H / 2]];
            const a = (o.angle * Math.PI) / 180;
            const bw = Math.abs(itemW * Math.cos(a)) + Math.abs(itemH * Math.sin(a));
            const bh = Math.abs(itemW * Math.sin(a)) + Math.abs(itemH * Math.cos(a));
            const gx = bw + Math.max(40, W * 0.08), gy = bh + Math.max(40, H * 0.08);
            const out = [];
            let row = 0;
            for (let y = gy / 2; y < H + gy; y += gy, row++) {
                for (let x = row % 2 ? gx / 2 : 0; x < W + gx; x += gx) out.push([x, y]);
            }
            return out;
        };

        const targetPages = () => {
            if (o.pages === 'all') return { list: [...Array(file.pageCount).keys()] };
            const r = Engine.parseRanges(o.range, file.pageCount);
            return { list: [...new Set(r.groups.flat())], error: r.error };
        };

        /* ---------- Vista previa ---------- */
        const drawPreview = (state) => {
            const ov = state.overlay;
            ov.innerHTML = '';
            const { list } = targetPages();
            if (!list.includes(state.index)) return;
            const c = document.createElement('canvas');
            const dpr = Math.min(devicePixelRatio || 1, 2);
            c.width = state.width * dpr; c.height = state.height * dpr;
            c.style.cssText = 'width:100%;height:100%';
            const g = c.getContext('2d');
            g.scale(dpr * state.scale, dpr * state.scale); // ahora 1 unidad = 1 punto
            g.globalAlpha = o.opacity / 100;
            const W = state.width / state.scale, H = state.height / state.scale;
            if (o.type === 'text') {
                if (!o.text) return;
                g.font = FONTS[o.font][1].replace('{s}', o.size);
                g.fillStyle = o.color;
                g.textAlign = 'center';
                g.textBaseline = 'middle';
                const tw = g.measureText(o.text).width;
                positions(W, H, tw, o.size).forEach(([x, y]) => {
                    g.save(); g.translate(x, y); g.rotate((-o.angle * Math.PI) / 180); g.fillText(o.text, 0, 0); g.restore();
                });
            } else if (o.image) {
                const iw = (W * o.imgScale) / 100, ih = (iw * o.image.height) / o.image.width;
                positions(W, H, iw, ih).forEach(([x, y]) => {
                    g.save(); g.translate(x, y); g.rotate((-o.angle * Math.PI) / 180); g.drawImage(o.image.el, -iw / 2, -ih / 2, iw, ih); g.restore();
                });
            }
            ov.appendChild(c);
        };
        const refresh = () => { if (preview?.width) drawPreview(preview); };

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF al que quieres poner marca de agua', multiple: false, color: ctx.tool.color, iconName: 'droplet', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const holder = UI.el('<div></div>');
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), holder);
            preview = Comp.pagePreview(file, { maxWidth: 560, onRender: drawPreview });
            holder.appendChild(preview.el);
            renderSide();
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="segmented" data-g="type">
                        <button type="button" data-value="text" aria-pressed="${o.type === 'text'}">${icon('text')}Texto</button>
                        <button type="button" data-value="image" aria-pressed="${o.type === 'image'}">${icon('image')}Imagen</button>
                    </div>
                </div>
                ${o.type === 'text' ? `
                <div class="side-block">
                    <div class="field"><label>Texto</label><input class="input" id="wText" value="${UI.esc(o.text)}"></div>
                    <div class="field"><label>Fuente</label><select class="input" id="wFont">${Object.entries(FONTS).map(([k, v]) => `<option value="${k}" ${k === o.font ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
                    <div class="field"><label>Tamaño</label>${Comp.range({ id: 'wSize', min: 10, max: 200, value: o.size, unit: ' pt' })}</div>
                    <div class="field"><label>Color</label><div class="swatches" data-g="color">${COLORS.map((c) => `<button type="button" data-value="${c}" aria-pressed="${c === o.color}" style="background:${c}"></button>`).join('')}<input type="color" id="wColor" value="${o.color}"></div></div>
                </div>` : `
                <div class="side-block">
                    <button class="btn" id="wPick" style="width:100%">${icon('image')}${o.image ? 'Cambiar imagen' : 'Elegir imagen (logo)'}</button>
                    ${o.image ? `<div style="margin-top:10px;padding:10px;border-radius:10px;background:var(--surface-2);text-align:center"><img src="${o.image.url}" style="max-height:70px;max-width:100%"></div>` : ''}
                    <div class="field" style="margin-top:12px"><label>Tamaño (ancho de página)</label>${Comp.range({ id: 'wImgScale', min: 5, max: 100, value: o.imgScale, unit: '%' })}</div>
                </div>`}
                <div class="side-block">
                    <div class="field"><label>Opacidad</label>${Comp.range({ id: 'wOpacity', min: 5, max: 100, value: o.opacity, unit: '%' })}</div>
                    <div class="field"><label>Rotación</label>
                        <div class="segmented" data-g="angle" style="margin-bottom:8px">${[0, 45, 90, -45].map((a) => `<button type="button" data-value="${a}" aria-pressed="${a === o.angle}">${a}°</button>`).join('')}</div>
                        ${Comp.range({ id: 'wAngle', min: -180, max: 180, value: o.angle, unit: '°' })}
                    </div>
                    <div class="field"><label>Disposición</label>
                        <div class="segmented" data-g="layout">
                            <button type="button" data-value="center" aria-pressed="${o.layout === 'center'}">${icon('center')}Centrada</button>
                            <button type="button" data-value="tile" aria-pressed="${o.layout === 'tile'}">${icon('tile')}Mosaico</button>
                        </div>
                    </div>
                    <label class="check"><input type="checkbox" id="wBehind" ${o.behind ? 'checked' : ''}>Detrás del contenido</label>
                    <p class="hint" style="margin:2px 0 0 26px">En documentos escaneados quedaría oculta.</p>
                </div>
                <div class="side-block">
                    <div class="field"><label>Páginas</label>
                        <div class="segmented" data-g="pages"><button type="button" data-value="all" aria-pressed="${o.pages === 'all'}">Todas</button><button type="button" data-value="range" aria-pressed="${o.pages === 'range'}">Elegir</button></div>
                    </div>
                    ${o.pages === 'range' ? `<div class="field"><input class="input" id="wRange" value="${UI.esc(o.range)}" placeholder="Ej: 1-3, 5"><span class="hint" data-rh></span></div>` : ''}
                </div>`;
            const s = ctx.side;
            Comp.bindRanges(s, { wSize: ' pt', wOpacity: '%', wAngle: '°', wImgScale: '%' });
            const seg = (g, fn) => { const el = s.querySelector(`[data-g="${g}"]`); if (el) UI.bindChoice(el, 'button', fn); };
            seg('type', (v) => { o.type = v; renderSide(); refresh(); });
            seg('layout', (v) => { o.layout = v; refresh(); });
            seg('pages', (v) => { o.pages = v; renderSide(); refresh(); });
            seg('angle', (v) => { o.angle = +v; s.querySelector('#wAngle').value = v; s.querySelector('[data-for="wAngle"]').textContent = v + '°'; refresh(); });
            seg('color', (v) => { o.color = v; s.querySelector('#wColor').value = v; refresh(); });
            const inp = (id, fn, ev = 'input') => s.querySelector('#' + id)?.addEventListener(ev, (e) => { fn(e.target); refresh(); });
            inp('wText', (t) => { o.text = t.value; });
            inp('wFont', (t) => { o.font = t.value; }, 'change');
            inp('wSize', (t) => { o.size = +t.value; });
            inp('wColor', (t) => { o.color = t.value; s.querySelectorAll('[data-g="color"] button').forEach((b) => b.setAttribute('aria-pressed', 'false')); });
            inp('wOpacity', (t) => { o.opacity = +t.value; });
            inp('wAngle', (t) => { o.angle = +t.value; s.querySelectorAll('[data-g="angle"] button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.value === o.angle))); });
            inp('wImgScale', (t) => { o.imgScale = +t.value; });
            inp('wBehind', (t) => { o.behind = t.checked; }, 'change');
            const rh = () => { const el = s.querySelector('[data-rh]'); if (el) { const { error, list } = targetPages(); el.textContent = error || (o.range ? UI.plural(list.length, 'página', 'páginas') : 'Escribe las páginas'); el.style.color = error ? 'var(--accent)' : ''; } };
            inp('wRange', (t) => { o.range = t.value; rh(); });
            rh();
            s.querySelector('#wPick')?.addEventListener('click', async () => {
                const [f] = await UI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: false });
                if (!f) return;
                const prepared = await Engine.prepareImage(f);
                const url = URL.createObjectURL(new Blob([prepared.bytes], { type: prepared.type === 'jpg' ? 'image/jpeg' : 'image/png' }));
                const el = new Image();
                el.src = url;
                await el.decode();
                o.image = { ...prepared, url, el };
                renderSide();
                refresh();
            });
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('droplet')}Aplicar marca de agua</button>`);
            go.addEventListener('click', apply);
            ctx.footer.appendChild(go);
        };

        const apply = () => {
            const { list, error } = targetPages();
            if (error || !list.length) return UI.toast(error || 'Elige al menos una página', 'warn');
            if (o.type === 'text' && !o.text.trim()) return UI.toast('Escribe el texto de la marca de agua', 'warn');
            if (o.type === 'image' && !o.image) return UI.toast('Elige una imagen', 'warn');
            return UI.task('Aplicando marca de agua…', async () => {
                const doc = await Engine.freshDoc(file);
                const pages = doc.getPages();
                const font = o.type === 'text' ? await doc.embedFont(PDFLib.StandardFonts[o.font]) : null;
                const img = o.type === 'image' ? await Engine.embedImage(doc, o.image) : null;
                const color = Engine.hexToRgb(o.color);
                const { text, lost } = font ? Engine.safeText(font, o.text) : { text: '' };
                if (lost) UI.toast('Algunos caracteres no son compatibles y se reemplazaron por "?"', 'warn');
                for (let k = 0; k < list.length; k++) {
                    UI.progress(k, list.length);
                    const i = list[k];
                    const page = pages[i];
                    const fr = await Engine.visualFrame(file, i);
                    Engine.isolatePage(doc, page);
                    if (font) {
                        const tw = font.widthOfTextAtSize(text, o.size);
                        positions(fr.width, fr.height, tw, o.size).forEach(([cx, cy]) => {
                            Engine.drawTextCentered(page, fr, text, { cx, cy, angle: o.angle, size: o.size, font, color, opacity: o.opacity / 100 });
                        });
                    } else {
                        const iw = (fr.width * o.imgScale) / 100, ih = (iw * o.image.height) / o.image.width;
                        const a = (o.angle * Math.PI) / 180;
                        const u = [Math.cos(a), -Math.sin(a)], v = [-Math.sin(a), -Math.cos(a)];
                        positions(fr.width, fr.height, iw, ih).forEach(([cx, cy]) => {
                            const bl = fr.P(cx - u[0] * iw / 2 - v[0] * ih / 2, cy - u[1] * iw / 2 - v[1] * ih / 2);
                            page.drawImage(img, { x: bl.x, y: bl.y, width: iw, height: ih, opacity: o.opacity / 100, rotate: PDFLib.degrees(fr.rot + o.angle) });
                        });
                    }
                    if (o.behind) Engine.sendDrawingToBack(page);
                }
                const bytes = await Engine.save(doc);
                Comp.finish(ctx, {
                    out: { bytes, name: UI.baseName(file.name) + '_marca.pdf' },
                    title: '¡Marca de agua aplicada!',
                    sub: `${UI.plural(list.length, 'página', 'páginas')} marcadas · ${UI.formatBytes(bytes.length)}`,
                    onBack: render,
                });
            });
        };

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

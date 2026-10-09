/* Numerar páginas: posición visual, formato y vista previa en vivo */
Tools.register({
    id: 'numerar',
    name: 'Numerar páginas',
    desc: 'Añade números de página donde quieras, con el formato que elijas.',
    icon: 'hash',
    color: '#2f9e5b',
    section: 'editar',
    mount(ctx) {
        let file = null;
        let preview = null;
        const o = { pos: 'bc', format: 'n', start: 1, skipFirst: false, size: 11, color: '#333333', margin: 28, font: 'Helvetica' };
        const FORMATS = {
            n: ['1', (n) => `${n}`],
            pagina: ['Página 1', (n) => `Página ${n}`],
            slash: ['1 / 10', (n, t) => `${n} / ${t}`],
            de: ['Página 1 de 10', (n, t) => `Página ${n} de ${t}`],
            dash: ['- 1 -', (n) => `- ${n} -`],
        };

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        /** Texto y número para la página i (null si no se numera) */
        const labelFor = (i) => {
            if (o.skipFirst && i === 0) return null;
            const first = o.skipFirst ? 1 : 0;
            const n = o.start + (i - first);
            const total = o.start + (file.pageCount - 1 - first);
            return FORMATS[o.format][1](n, total);
        };

        /** Punto de anclaje visual y alineación */
        const anchor = (W, H, tw, size) => {
            const m = o.margin;
            const col = o.pos[1], row = o.pos[0];
            const x = col === 'l' ? m : col === 'r' ? W - m - tw : (W - tw) / 2;
            const yBase = row === 't' ? m + size * 0.72 : H - m;
            return { x, y: yBase };
        };

        const drawPreview = (state) => {
            const ov = state.overlay;
            ov.innerHTML = '';
            const label = labelFor(state.index);
            if (!label) return;
            const c = document.createElement('canvas');
            const dpr = Math.min(devicePixelRatio || 1, 2);
            c.width = state.width * dpr; c.height = state.height * dpr;
            c.style.cssText = 'width:100%;height:100%';
            const g = c.getContext('2d');
            g.scale(dpr * state.scale, dpr * state.scale);
            g.font = `${o.size}px Helvetica, Arial, sans-serif`;
            g.fillStyle = o.color;
            const tw = g.measureText(label).width;
            const { x, y } = anchor(state.width / state.scale, state.height / state.scale, tw, o.size);
            g.fillText(label, x, y);
            // resalta la zona
            g.strokeStyle = 'rgba(47,158,91,.6)';
            g.setLineDash([3, 3]);
            g.lineWidth = 1;
            g.strokeRect(x - 4, y - o.size * 0.9, tw + 8, o.size * 1.25);
            ov.appendChild(c);
        };
        const refresh = () => { if (preview?.width) drawPreview(preview); };

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres numerar', multiple: false, color: ctx.tool.color, iconName: 'hash', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const holder = UI.el('<div></div>');
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), holder);
            preview = Comp.pagePreview(file, { maxWidth: 520, onRender: drawPreview });
            holder.appendChild(preview.el);
            renderSide();
        };

        const renderSide = () => {
            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Posición</div>
                    <div data-pos style="display:flex;justify-content:center"></div>
                </div>
                <div class="side-block">
                    <div class="side-title">Formato</div>
                    <div class="option-cards">${Object.entries(FORMATS).map(([k, [label]]) => `<button type="button" class="option-card" data-value="${k}" aria-pressed="${k === o.format}" style="padding:9px 12px"><span><strong>${UI.esc(label)}</strong></span></button>`).join('')}</div>
                </div>
                <div class="side-block">
                    <div class="field-row">
                        <div class="field"><label>Empezar en</label><input type="number" class="input" id="nStart" min="0" value="${o.start}"></div>
                        <div class="field"><label>Color</label><input type="color" id="nColor" value="${o.color}"></div>
                    </div>
                    <label class="check"><input type="checkbox" id="nSkip" ${o.skipFirst ? 'checked' : ''}>No numerar la primera página (portada)</label>
                    <div class="field" style="margin-top:10px"><label>Tamaño</label>${Comp.range({ id: 'nSize', min: 6, max: 36, value: o.size, unit: ' pt' })}</div>
                    <div class="field"><label>Margen</label>${Comp.range({ id: 'nMargin', min: 8, max: 80, value: o.margin, unit: ' pt' })}</div>
                </div>`;
            const s = ctx.side;
            s.querySelector('[data-pos]').appendChild(Comp.posGrid(o.pos, (v) => { o.pos = v; refresh(); }, ['tl', 'tc', 'tr', 'bl', 'bc', 'br']));
            UI.bindChoice(s, '.option-card', (v) => { o.format = v; refresh(); });
            Comp.bindRanges(s, { nSize: ' pt', nMargin: ' pt' });
            const on = (id, fn, ev = 'input') => s.querySelector('#' + id).addEventListener(ev, (e) => { fn(e.target); refresh(); });
            on('nStart', (t) => { o.start = Math.max(0, parseInt(t.value, 10) || 0); });
            on('nColor', (t) => { o.color = t.value; });
            on('nSkip', (t) => { o.skipFirst = t.checked; }, 'change');
            on('nSize', (t) => { o.size = +t.value; });
            on('nMargin', (t) => { o.margin = +t.value; });
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg">${icon('hash')}Numerar páginas</button>`);
            go.addEventListener('click', apply);
            ctx.footer.appendChild(go);
        };

        const apply = () => UI.task('Numerando páginas…', async () => {
            const doc = await Engine.freshDoc(file);
            const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
            const color = Engine.hexToRgb(o.color);
            const pages = doc.getPages();
            let count = 0;
            for (let i = 0; i < pages.length; i++) {
                UI.progress(i, pages.length);
                const label = labelFor(i);
                if (!label) continue;
                const fr = await Engine.visualFrame(file, i);
                const tw = font.widthOfTextAtSize(label, o.size);
                const { x, y } = anchor(fr.width, fr.height, tw, o.size);
                const p = fr.P(x, y);
                Engine.isolatePage(doc, pages[i]);
                pages[i].drawText(label, { x: p.x, y: p.y, size: o.size, font, color, rotate: PDFLib.degrees(fr.rot) });
                count++;
            }
            const bytes = await Engine.save(doc);
            Comp.finish(ctx, {
                out: { bytes, name: UI.baseName(file.name) + '_numerado.pdf' },
                title: '¡Páginas numeradas!',
                sub: `${UI.plural(count, 'página numerada', 'páginas numeradas')} · ${UI.formatBytes(bytes.length)}`,
                onBack: render,
            });
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

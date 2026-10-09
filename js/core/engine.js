/* Motor PDF: carga, descifrado, renderizado de miniaturas y qpdf.
   Todo se ejecuta en el navegador; nada se envía a la red. */
(function () {
    const { PDFDocument } = PDFLib;
    const isFile = location.protocol === 'file:';
    const Engine = {};

    const COLORS = ['#e5484d', '#3b6fe0', '#2f9e5b', '#d68a00', '#8e4ec6', '#0894b3', '#d6409f', '#6e56cf', '#f76b15', '#12a594'];
    let fileSeq = 0;

    /* ---------- pdf.js ---------- */
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdfjs/pdf.worker.min.js';
    let pdfjsReady = null;
    const loadScript = (src) => new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = res;
        s.onerror = () => rej(new Error('No se pudo cargar ' + src));
        document.head.appendChild(s);
    });
    // Desde file:// el navegador no permite Web Workers: se usa el hilo principal.
    const ensurePdfJs = () => (pdfjsReady ||= isFile && !window.pdfjsWorker ? loadScript('lib/pdfjs/pdf.worker.min.js') : Promise.resolve());

    Engine.openPdfJs = async (bytes, password) => {
        await ensurePdfJs();
        return pdfjsLib.getDocument({
            data: bytes.slice(), // pdf.js se queda con el buffer: se le pasa una copia
            password,
            isEvalSupported: false,
            cMapUrl: 'lib/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'lib/pdfjs/standard_fonts/',
            useSystemFonts: true,
        }).promise;
    };

    /* ---------- qpdf (WebAssembly) ---------- */
    let qpdfPromise = null;
    let qpdfLog = [];
    Engine.qpdf = () => (qpdfPromise ||= (async () => {
        await loadScript('lib/qpdf/qpdf.js');
        if (isFile) await loadScript('lib/qpdf/qpdf-wasm-data.js');
        return window.Module({
            noInitialRun: true,
            locateFile: () => (isFile ? window.QPDF_WASM_DATA_URI : 'lib/qpdf/qpdf.wasm'),
            print: (t) => qpdfLog.push(t),
            printErr: (t) => qpdfLog.push(t),
        });
    })().catch((e) => { qpdfPromise = null; throw e; }));

    /** Ejecuta qpdf con un archivo de entrada y devuelve el de salida */
    Engine.runQpdf = async (bytes, argsBuilder) => {
        const q = await Engine.qpdf();
        const id = Math.random().toString(36).slice(2);
        const inp = `/in_${id}.pdf`, out = `/out_${id}.pdf`;
        q.FS.writeFile(inp, bytes);
        qpdfLog = [];
        let code;
        try {
            code = q.callMain(argsBuilder(inp, out));
        } catch (e) {
            code = typeof e?.status === 'number' ? e.status : 2;
        }
        let result = null;
        try { result = q.FS.readFile(out); } catch { /* sin salida */ }
        try { q.FS.unlink(inp); } catch { /* */ }
        try { q.FS.unlink(out); } catch { /* */ }
        // código 3 = terminó con advertencias (la salida es válida)
        if ((code === 0 || code === 3) && result) return result;
        const msg = qpdfLog.join(' ');
        const err = new Error(/invalid password/i.test(msg) ? 'WRONG_PASSWORD' : msg || 'qpdf falló');
        err.qpdf = true;
        throw err;
    };

    // Solo se llama con PDFs cifrados; si qpdf falla, casi siempre es por la contraseña
    // (esta compilación de qpdf manda sus mensajes a la consola y no siempre se pueden leer).
    Engine.decrypt = (bytes, password = '') =>
        Engine.runQpdf(bytes, (i, o) => [`--password=${password}`, '--decrypt', i, o]).catch((e) => {
            if (e.qpdf) e.message = 'WRONG_PASSWORD';
            throw e;
        });

    Engine.encrypt = (bytes, userPw, ownerPw, perms) => Engine.runQpdf(bytes, (i, o) => [
        i, '--encrypt', userPw, ownerPw, '256',
        `--print=${perms.print ? 'full' : 'none'}`,
        `--modify=${perms.modify ? 'all' : 'none'}`,
        `--extract=${perms.copy ? 'y' : 'n'}`,
        `--annotate=${perms.annotate ? 'y' : 'n'}`,
        `--form=${perms.forms ? 'y' : 'n'}`,
        '--', o,
    ]);

    Engine.optimize = (bytes) => Engine.runQpdf(bytes, (i, o) => [
        i, '--object-streams=generate', '--compress-streams=y', '--recompress-flate',
        '--compression-level=9', '--decode-level=generalized', '--remove-unreferenced-resources=yes', o,
    ]);

    /* ---------- Carga de archivos ---------- */
    const readBytes = (file) => file.arrayBuffer().then((b) => new Uint8Array(b));

    const isEncryptedError = (e) => /encrypt/i.test(String(e?.message || e));

    /**
     * Carga un PDF (File) y devuelve un objeto PdfFile.
     * Si está protegido pide la contraseña y lo descifra en memoria.
     * Devuelve null si el usuario cancela.
     */
    Engine.loadPdf = async (file, { askPassword = true } = {}) => {
        let bytes = await readBytes(file);
        if (!looksLikePdf(bytes)) throw new Error(`"${file.name}" no es un PDF válido.`);
        let libDoc, wasEncrypted = false, password = '';
        try {
            libDoc = await PDFDocument.load(bytes, { updateMetadata: false });
        } catch (e) {
            if (!isEncryptedError(e)) throw e;
            wasEncrypted = true;
        }
        if (wasEncrypted) {
            // Muchos PDF solo tienen contraseña de propietario: se abren sin contraseña.
            let dec = null, wrong = false;
            try { dec = await Engine.decrypt(bytes, ''); } catch (e) { if (e.message !== 'WRONG_PASSWORD') throw e; }
            while (!dec) {
                if (!askPassword) { const err = new Error('WRONG_PASSWORD'); err.needsPassword = true; throw err; }
                UI.idle();
                const pw = await UI.askPassword(file.name, wrong);
                if (pw === undefined) return null;
                UI.busy('Descifrando…');
                try { dec = await Engine.decrypt(bytes, pw); password = pw; } catch (e) { if (e.message !== 'WRONG_PASSWORD') throw e; wrong = true; }
            }
            bytes = dec;
            libDoc = await PDFDocument.load(bytes, { updateMetadata: false });
        }
        return {
            id: ++fileSeq,
            name: file.name,
            size: file.size,
            bytes,
            wasEncrypted,
            password,
            pageCount: libDoc.getPageCount(),
            color: COLORS[(fileSeq - 1) % COLORS.length],
            _lib: libDoc,
            _pdfjs: null,
        };
    };

    /** Carga varios archivos mostrando progreso; ignora los no válidos con aviso */
    Engine.loadMany = async (files) => {
        const out = [];
        const pdfs = files.filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
        if (pdfs.length < files.length) UI.toast(`Se ignoraron ${files.length - pdfs.length} archivo(s) que no son PDF`, 'warn');
        if (!pdfs.length) return out;
        UI.busy(pdfs.length > 1 ? `Abriendo ${pdfs.length} PDFs…` : 'Abriendo PDF…');
        try {
            for (let i = 0; i < pdfs.length; i++) {
                if (pdfs.length > 1) UI.progress(i, pdfs.length);
                try {
                    const f = await Engine.loadPdf(pdfs[i]);
                    if (f) out.push(f);
                } catch (e) {
                    console.error(e);
                    UI.toast(`${pdfs[i].name}: ${UI.errorMessage(e)}`, 'err', 6000);
                }
            }
        } finally { UI.idle(); }
        return out;
    };

    const looksLikePdf = (b) => {
        const head = new TextDecoder('latin1').decode(b.subarray(0, 1024));
        return head.includes('%PDF');
    };

    Engine.libDoc = async (f) => (f._lib ||= await PDFDocument.load(f.bytes, { updateMetadata: false }));
    Engine.pdfjsDoc = (f) => (f._pdfjs ||= Engine.openPdfJs(f.bytes));

    /** Reemplaza los bytes de un PdfFile (tras editarlo) */
    Engine.replaceBytes = async (f, bytes) => {
        f.bytes = bytes;
        f._lib = null;
        if (f._pdfjs) (await f._pdfjs).destroy();
        f._pdfjs = null;
        thumbCache.forEach((v, k) => { if (k.startsWith(f.id + ':')) { URL.revokeObjectURL(v); thumbCache.delete(k); } });
        f.pageCount = (await Engine.libDoc(f)).getPageCount();
    };

    /* ---------- Renderizado ---------- */
    // Cola con concurrencia limitada para no saturar el dispositivo
    const queue = [];
    let running = 0;
    const MAX = 2;
    const pump = () => {
        while (running < MAX && queue.length) {
            const job = queue.shift();
            running++;
            job().finally(() => { running--; pump(); });
        }
    };
    const enqueue = (fn) => new Promise((res, rej) => { queue.push(() => fn().then(res, rej)); pump(); });

    /** Renderiza una página a un canvas con el ancho/escala dado */
    Engine.renderToCanvas = async (f, index, { width, scale, canvas, rotation = 0 } = {}) => {
        const doc = await Engine.pdfjsDoc(f);
        const page = await doc.getPage(index + 1);
        const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
        const s = scale || width / base.width;
        const vp = page.getViewport({ scale: s, rotation: (page.rotate + rotation) % 360 });
        const c = canvas || document.createElement('canvas');
        c.width = Math.max(1, Math.floor(vp.width));
        c.height = Math.max(1, Math.floor(vp.height));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        return { canvas: c, viewport: vp, page };
    };

    const thumbCache = new Map();
    /** URL (blob:) de la miniatura de una página. Ancho fijo para reutilizar caché. */
    Engine.thumbUrl = (f, index, width = 240) => {
        const key = `${f.id}:${index}:${width}`;
        if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key));
        return enqueue(async () => {
            if (thumbCache.has(key)) return thumbCache.get(key);
            const { canvas } = await Engine.renderToCanvas(f, index, { width: width * Math.min(devicePixelRatio || 1, 2) });
            const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
            const url = URL.createObjectURL(blob);
            thumbCache.set(key, url);
            return url;
        });
    };

    /** Dimensiones (en puntos) de una página considerando su rotación */
    Engine.pageSize = async (f, index) => {
        const p = (await Engine.libDoc(f)).getPage(index);
        const { width, height } = p.getSize();
        const rot = ((p.getRotation().angle % 360) + 360) % 360;
        return rot % 180 ? { width: height, height: width, rotation: rot } : { width, height, rotation: rot };
    };

    /**
     * Crea un <img> de miniatura que se renderiza solo cuando entra en pantalla.
     */
    const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
            if (!en.isIntersecting) return;
            const img = en.target;
            io.unobserve(img);
            img._load();
        });
    }, { rootMargin: '400px' });

    Engine.lazyThumb = (f, index, width = 240) => {
        const img = document.createElement('img');
        img.className = 'thumb placeholder';
        img.alt = '';
        img.setAttribute('aria-label', `Página ${index + 1}`);
        img.draggable = false;
        img._load = () => Engine.thumbUrl(f, index, width).then((url) => {
            img.addEventListener('load', () => {
                img.classList.remove('placeholder');
                img.dispatchEvent(new Event('thumbready'));
            }, { once: true });
            img.src = url;
        }).catch((e) => { console.error(e); img.classList.remove('placeholder'); });
        io.observe(img);
        return img;
    };

    /**
     * Envuelve el contenido original de una página en q/Q para que lo que se
     * dibuje después no herede transformaciones sueltas del PDF original.
     * Debe llamarse antes de dibujar en la página.
     */
    Engine.isolatePage = (doc, page) => {
        page.node.normalize();
        const start = page.createContentStream(PDFLib.pushGraphicsState());
        const end = page.createContentStream(PDFLib.popGraphicsState());
        page.node.wrapContentStreams(doc.context.register(start), doc.context.register(end));
    };

    /**
     * Herramientas para dibujar en "coordenadas visuales" de una página
     * (puntos, origen arriba-izquierda, tal como se ve con su rotación).
     * Devuelve { width, height, P(x,y)->punto PDF, rot (grados de la página) }.
     */
    Engine.visualFrame = async (f, index) => {
        const page = await (await Engine.pdfjsDoc(f)).getPage(index + 1);
        const vp = page.getViewport({ scale: 1 });
        const P = (x, y) => { const [a, b] = vp.convertToPdfPoint(x, y); return { x: a, y: b }; };
        const o0 = P(0, 0), o1 = P(1, 0);
        return { width: vp.width, height: vp.height, P, rot: (Math.atan2(o1.y - o0.y, o1.x - o0.x) * 180) / Math.PI };
    };

    /**
     * Dibuja texto centrado en (cx, cy) visual, girado `angle` grados (antihorario).
     */
    Engine.drawTextCentered = (page, frame, text, { cx, cy, angle = 0, size, font, color, opacity = 1 }) => {
        const w = font.widthOfTextAtSize(text, size);
        const capH = font.heightAtSize(size, { descender: false }) * 0.72;
        const a = (angle * Math.PI) / 180;
        const u = [Math.cos(a), -Math.sin(a)];   // dirección del texto (visual, y hacia abajo)
        const v = [-Math.sin(a), -Math.cos(a)];  // "arriba" del texto
        const sx = cx - u[0] * w / 2 - v[0] * capH / 2;
        const sy = cy - u[1] * w / 2 - v[1] * capH / 2;
        const p = frame.P(sx, sy);
        page.drawText(text, { x: p.x, y: p.y, size, font, color, opacity, rotate: PDFLib.degrees(frame.rot + angle) });
    };

    /** Mueve el último contenido dibujado por pdf-lib al fondo de la página */
    Engine.sendDrawingToBack = (page) => {
        const contents = page.node.Contents();
        if (!contents || !contents.asArray) return;
        const ref = page.contentStreamRef;
        const i = contents.asArray().findIndex((r) => r === ref);
        if (i > 0) { contents.remove(i); contents.insert(0, ref); }
    };

    /** Renderiza una página a canvas sin depender de requestAnimationFrame (para exportar) */
    Engine.renderForExport = async (f, index, scale) => {
        const page = await (await Engine.pdfjsDoc(f)).getPage(index + 1);
        const vp = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(vp.width));
        c.height = Math.max(1, Math.round(vp.height));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp, intent: 'print' }).promise;
        page.cleanup();
        return { canvas: c, ptWidth: vp.width / scale, ptHeight: vp.height / scale };
    };

    /** Carga una copia nueva (editable) del documento con pdf-lib */
    Engine.freshDoc = (f) => PDFDocument.load(f.bytes, { updateMetadata: false });

    /* ---------- Guardado ---------- */
    Engine.save = (doc) => doc.save({ useObjectStreams: true });

    Engine.newDoc = async () => {
        const d = await PDFDocument.create();
        d.setProducer('LumenPDF (local)');
        d.setCreator('LumenPDF');
        return d;
    };

    /* ---------- Rangos de páginas ---------- */
    /**
     * Interpreta "1-3, 5, 8-" -> [[0,1,2],[4],[7,8,...]] (índices base 0).
     * Devuelve { groups, error }.
     */
    Engine.parseRanges = (str, total) => {
        const groups = [];
        const parts = String(str).split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
        for (const p of parts) {
            const m = p.match(/^(\d*)\s*-\s*(\d*)$/);
            let a, b;
            if (m) {
                a = m[1] ? +m[1] : 1;
                b = m[2] ? +m[2] : total;
            } else if (/^\d+$/.test(p)) {
                a = b = +p;
            } else return { groups: [], error: `No entiendo "${p}"` };
            if (a < 1 || b < 1 || a > total || b > total) return { groups: [], error: `"${p}" está fuera de 1–${total}` };
            const g = [];
            if (a <= b) for (let i = a; i <= b; i++) g.push(i - 1);
            else for (let i = a; i >= b; i--) g.push(i - 1);
            groups.push(g);
        }
        return { groups, error: null };
    };

    Engine.rangesToText = (indices) => {
        const s = [...new Set(indices)].sort((a, b) => a - b).map((i) => i + 1);
        const out = [];
        for (let i = 0; i < s.length; i++) {
            let j = i;
            while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
            out.push(i === j ? `${s[i]}` : `${s[i]}-${s[j]}`);
            i = j;
        }
        return out.join(', ');
    };

    /* ---------- Imágenes ---------- */
    /** Lee la orientación EXIF de un JPEG (1 si no hay) */
    const jpegOrientation = (b) => {
        const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
        if (v.getUint16(0) !== 0xffd8) return 1;
        let off = 2;
        while (off + 4 < v.byteLength) {
            const marker = v.getUint16(off);
            const len = v.getUint16(off + 2);
            if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
                const t = off + 10;
                const le = v.getUint16(t) === 0x4949;
                const ifd = t + v.getUint32(t + 4, le);
                const n = v.getUint16(ifd, le);
                for (let i = 0; i < n; i++) {
                    const e = ifd + 2 + i * 12;
                    if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
                }
                return 1;
            }
            if ((marker & 0xff00) !== 0xff00) break;
            off += 2 + len;
        }
        return 1;
    };

    /**
     * Prepara una imagen (File) para incrustarla con pdf-lib.
     * Devuelve { bytes, type:'jpg'|'png', width, height }.
     */
    Engine.prepareImage = async (file) => {
        const bytes = await readBytes(file);
        const isJpg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
        const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
        if ((isJpg && jpegOrientation(bytes) === 1) || isPng) {
            const bmp = await createImageBitmap(new Blob([bytes]));
            const r = { bytes, type: isJpg ? 'jpg' : 'png', width: bmp.width, height: bmp.height };
            bmp.close();
            return r;
        }
        // Otros formatos (webp, gif, bmp) o JPEG rotado: se normaliza con canvas
        const bmp = await createImageBitmap(new Blob([bytes], { type: file.type }), { imageOrientation: 'from-image' });
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        bmp.close();
        const type = isJpg ? 'jpg' : 'png';
        const blob = await new Promise((r) => c.toBlob(r, type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
        return { bytes: new Uint8Array(await blob.arrayBuffer()), type, width: c.width, height: c.height };
    };

    Engine.embedImage = (doc, img) => (img.type === 'jpg' ? doc.embedJpg(img.bytes) : doc.embedPng(img.bytes));

    Engine.dataUrlToBytes = (url) => {
        const b64 = url.split(',')[1];
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    };

    Engine.hexToRgb = (hex) => {
        const n = parseInt(hex.replace('#', ''), 16);
        return PDFLib.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    };

    /** Elimina caracteres que las fuentes estándar (WinAnsi) no pueden dibujar */
    Engine.safeText = (font, text) => {
        let out = '', lost = false;
        for (const ch of text) {
            if (ch === '\n') { out += ch; continue; }
            try { font.encodeText(ch); out += ch; } catch { out += '?'; lost = true; }
        }
        return { text: out, lost };
    };

    Engine.COLORS = COLORS;
    window.Engine = Engine;
})();

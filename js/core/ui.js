/* Utilidades de interfaz: DOM, avisos, modales, indicador de progreso, descargas */
(function () {
    const UI = {};

    UI.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /** Crea un elemento a partir de HTML (devuelve el primer nodo) */
    UI.el = (html) => {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstElementChild;
    };

    UI.formatBytes = (n) => {
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
        return (n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 2 : 1) + ' MB';
    };

    UI.plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

    UI.debounce = (fn, ms = 150) => {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    };

    UI.baseName = (name) => String(name || 'documento').replace(/\.[^.]+$/, '');

    /* ---------- Avisos ---------- */
    UI.toast = (msg, type = 'ok', ms = 3200) => {
        const ic = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' }[type] || 'info';
        const t = UI.el(`<div class="toast ${type}">${icon(ic)}<span>${UI.esc(msg)}</span></div>`);
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, ms);
    };

    /* ---------- Indicador de "procesando" ---------- */
    let busyDepth = 0;
    UI.busy = (text = 'Procesando…') => {
        busyDepth++;
        document.getElementById('busyText').textContent = text;
        document.getElementById('busyProgressWrap').hidden = true;
        document.getElementById('busy').hidden = false;
    };
    UI.busyText = (text) => { document.getElementById('busyText').textContent = text; };
    UI.progress = (done, total) => {
        const wrap = document.getElementById('busyProgressWrap');
        wrap.hidden = false;
        document.getElementById('busyProgress').style.width = Math.round((done / Math.max(total, 1)) * 100) + '%';
    };
    UI.idle = () => {
        busyDepth = Math.max(0, busyDepth - 1);
        if (!busyDepth) document.getElementById('busy').hidden = true;
    };
    /** Ejecuta una tarea mostrando el indicador y capturando errores */
    UI.task = async (text, fn) => {
        UI.busy(text);
        // deja que el navegador pinte el overlay antes de trabajar
        await new Promise((r) => setTimeout(r, 30));
        try {
            return await fn();
        } catch (e) {
            console.error(e);
            UI.toast(UI.errorMessage(e), 'err', 6000);
            return undefined;
        } finally {
            UI.idle();
        }
    };
    UI.errorMessage = (e) => {
        const m = String(e && (e.message || e)) || 'Error desconocido';
        if (/encrypt/i.test(m)) return 'El PDF está protegido con contraseña. Usa "Quitar contraseña" primero.';
        if (/Invalid PDF|No PDF header|parse/i.test(m)) return 'El archivo no parece un PDF válido o está dañado.';
        return 'Ocurrió un error: ' + m;
    };

    /* ---------- Modales ---------- */
    /**
     * Abre un modal. `build(modalEl, close)` rellena el contenido.
     * Devuelve una promesa que se resuelve con el valor pasado a close().
     */
    UI.modal = ({ title, sub = '', body = '', wide = false, actions = [] }, build) => new Promise((resolve) => {
        const back = UI.el(`<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
            <h3>${UI.esc(title)}</h3>${sub ? `<p class="modal-sub">${sub}</p>` : ''}
            <div class="modal-body">${body}</div>
            <div class="modal-actions"></div></div></div>`);
        const modal = back.querySelector('.modal');
        const close = (val) => { back.remove(); document.removeEventListener('keydown', onKey); resolve(val); };
        const onKey = (e) => { if (e.key === 'Escape') close(undefined); };
        document.addEventListener('keydown', onKey);
        back.addEventListener('mousedown', (e) => { if (e.target === back) close(undefined); });
        const bar = modal.querySelector('.modal-actions');
        actions.forEach((a) => {
            const b = UI.el(`<button type="button" class="btn ${a.primary ? 'btn-primary' : ''}">${a.icon ? icon(a.icon) : ''}${UI.esc(a.label)}</button>`);
            b.addEventListener('click', () => (a.onClick ? a.onClick(close, modal) : close(a.value)));
            bar.appendChild(b);
        });
        document.getElementById('modalRoot').appendChild(back);
        if (build) build(modal, close);
        const first = modal.querySelector('input, textarea, select');
        if (first) setTimeout(() => first.focus(), 30);
    });

    UI.confirm = (title, sub, okLabel = 'Aceptar') => UI.modal({
        title, sub,
        actions: [{ label: 'Cancelar', value: false }, { label: okLabel, value: true, primary: true }],
    });

    /** Pide contraseña para abrir un PDF. Devuelve string o undefined. */
    UI.askPassword = (fileName, wrong = false) => UI.modal({
        title: 'PDF protegido',
        sub: `<b>${UI.esc(fileName)}</b> requiere contraseña para abrirse.`,
        body: `${wrong ? `<div class="info-box warn">${icon('alert')}<div>Contraseña incorrecta. Inténtalo de nuevo.</div></div>` : ''}
            <div class="field"><label>Contraseña</label>${UI.passwordInput('pwAsk')}</div>`,
        actions: [
            { label: 'Cancelar', value: undefined },
            { label: 'Abrir', primary: true, icon: 'unlock', onClick: (close, m) => close(m.querySelector('#pwAsk').value) },
        ],
    }, (m, close) => {
        UI.bindPasswordToggles(m);
        m.querySelector('#pwAsk').addEventListener('keydown', (e) => { if (e.key === 'Enter') close(e.target.value); });
    });

    UI.passwordInput = (id, placeholder = '') => `<div class="pw-wrap"><input type="password" class="input" id="${id}" autocomplete="off" placeholder="${UI.esc(placeholder)}"><button type="button" data-pwtoggle="${id}" aria-label="Mostrar contraseña">${icon('eye')}</button></div>`;
    UI.bindPasswordToggles = (root) => {
        root.querySelectorAll('[data-pwtoggle]').forEach((b) => b.addEventListener('click', () => {
            const inp = root.querySelector('#' + b.dataset.pwtoggle);
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            b.innerHTML = icon(show ? 'eyeOff' : 'eye');
        }));
    };

    /* ---------- Descargas (todo local, mediante blob:) ---------- */
    UI.download = (data, name, mime = 'application/pdf') => {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    /** Abre el selector de archivos del sistema */
    UI.pickFiles = ({ accept = 'application/pdf,.pdf', multiple = true } = {}) => new Promise((resolve) => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = accept;
        inp.multiple = multiple;
        inp.addEventListener('change', () => resolve([...inp.files]));
        inp.click();
    });

    /** Botones segmentados / tarjetas de opción: sincroniza aria-pressed */
    UI.bindChoice = (container, selector, onChange) => {
        container.querySelectorAll(selector).forEach((b) => b.addEventListener('click', () => {
            container.querySelectorAll(selector).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            onChange(b.dataset.value, b);
        }));
    };

    /* ---------- Tema ---------- */
    const THEME_KEY = 'lumenpdf-tema';
    const applyTheme = (t) => document.documentElement.setAttribute('data-theme', t);
    let theme;
    try { theme = localStorage.getItem(THEME_KEY); } catch { /* sin almacenamiento */ }
    if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(theme);
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('themeToggle').addEventListener('click', () => {
            theme = theme === 'dark' ? 'light' : 'dark';
            applyTheme(theme);
            try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignorar */ }
        });
    });

    window.UI = UI;
})();

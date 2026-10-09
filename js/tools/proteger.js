/* Proteger con contraseña (AES-256 mediante qpdf) y permisos */
Tools.register({
    id: 'proteger',
    name: 'Proteger con contraseña',
    desc: 'Cifra el PDF con AES-256 y controla qué se puede hacer con él.',
    icon: 'lock',
    color: '#e5484d',
    section: 'seguridad',
    mount(ctx) {
        let file = null;
        const perms = { print: true, copy: false, modify: false, annotate: true, forms: true };

        const load = async (list) => {
            const [f] = await Engine.loadMany(list.slice(0, 1));
            if (!f) return;
            file = f;
            render();
        };
        ctx.onCleanup(Comp.windowDrop('Suelta para cambiar de PDF', load, () => !!file));

        const strength = (pw) => {
            let s = 0;
            if (pw.length >= 6) s++;
            if (pw.length >= 10) s++;
            if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
            if (/\d/.test(pw)) s++;
            if (/[^A-Za-z0-9]/.test(pw)) s++;
            return [[0, 'Muy débil', '#e5484d'], [20, 'Muy débil', '#e5484d'], [40, 'Débil', '#f76b15'], [60, 'Aceptable', '#d68a00'], [80, 'Fuerte', '#2f9e5b'], [100, 'Muy fuerte', '#2f9e5b']][pw ? s : 0];
        };

        const render = () => {
            ctx.sideWrap.hidden = !file;
            if (!file) {
                ctx.body.replaceChildren(Comp.dropzone({ title: 'Suelta el PDF que quieres proteger', multiple: false, color: ctx.tool.color, iconName: 'lock', button: 'Elegir PDF', onFiles: load }));
                return;
            }
            const main = UI.el(`<div class="center-col" style="--c:${ctx.tool.color}">
                <div class="lock-visual">${icon('lock')}</div>
                <div class="field"><label for="pw1">Contraseña para abrir el PDF</label>${UI.passwordInput('pw1', 'Escribe una contraseña')}
                    <div class="strength"><div></div></div><span class="strength-label" data-sl>&nbsp;</span></div>
                <div class="field"><label for="pw2">Repite la contraseña</label>${UI.passwordInput('pw2')}<span class="hint" data-match>&nbsp;</span></div>
                ${Comp.infoBox('Guarda bien la contraseña: <b>no hay forma de recuperarla</b> si la olvidas. El cifrado ocurre en tu dispositivo.', true)}
            </div>`);
            UI.bindPasswordToggles(main);
            ctx.body.replaceChildren(Comp.docSummary(file, Comp.changeFileBtn(async () => load(await UI.pickFiles({ multiple: false })))), main);
            const pw1 = main.querySelector('#pw1'), pw2 = main.querySelector('#pw2');
            const check = () => {
                const [w, label, color] = strength(pw1.value);
                const bar = main.querySelector('.strength div');
                bar.style.width = w + '%';
                bar.style.background = color;
                main.querySelector('[data-sl]').textContent = pw1.value ? label : ' ';
                const m = main.querySelector('[data-match]');
                const ok = pw1.value && pw1.value === pw2.value;
                m.textContent = !pw2.value ? ' ' : ok ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden';
                m.style.color = !pw2.value ? '' : ok ? 'var(--ok)' : 'var(--accent)';
                const b = ctx.footer.querySelector('.btn-primary');
                if (b) b.disabled = !ok;
            };
            pw1.addEventListener('input', check);
            pw2.addEventListener('input', check);
            pw2.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ctx.footer.querySelector('.btn-primary').disabled) protect(pw1.value); });

            ctx.side.innerHTML = `
                <div class="side-block">
                    <div class="side-title">Permisos (sin la contraseña de propietario)</div>
                    ${[['print', 'Imprimir'], ['copy', 'Copiar texto e imágenes'], ['modify', 'Modificar el documento'], ['annotate', 'Añadir comentarios'], ['forms', 'Rellenar formularios']].map(([k, l]) => `<label class="check"><input type="checkbox" data-p="${k}" ${perms[k] ? 'checked' : ''}>${l}</label>`).join('')}
                    <p class="hint" style="margin-top:8px">Los lectores de PDF respetan estos permisos, aunque no todos los programas lo hacen.</p>
                </div>
                <div class="side-block">
                    <div class="stat-row"><span>Cifrado</span><span>AES-256</span></div>
                </div>`;
            ctx.side.querySelectorAll('[data-p]').forEach((c) => c.addEventListener('change', () => { perms[c.dataset.p] = c.checked; }));
            ctx.footer.innerHTML = '';
            const go = UI.el(`<button class="btn btn-primary btn-lg" disabled>${icon('lock')}Proteger PDF</button>`);
            go.addEventListener('click', () => protect(pw1.value));
            ctx.footer.appendChild(go);
            setTimeout(() => pw1.focus(), 50);
        };

        const protect = (pw) => UI.task('Cifrando con AES-256…', async () => {
            // contraseña de propietario aleatoria: así los permisos se aplican de verdad
            const owner = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
            const bytes = await Engine.encrypt(file.bytes, pw, owner, perms);
            Comp.finish(ctx, {
                out: { bytes, name: UI.baseName(file.name) + '_protegido.pdf' },
                title: '¡PDF protegido!',
                sub: `Ahora se necesita la contraseña para abrirlo · ${UI.formatBytes(bytes.length)}`,
                onBack: render,
            });
            ctx.body.querySelector('.rc-icon').innerHTML = icon('lock');
        });

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

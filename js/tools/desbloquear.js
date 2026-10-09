/* Quitar contraseña: descifra el PDF (con su contraseña) y lo guarda sin protección */
Tools.register({
    id: 'desbloquear',
    name: 'Quitar contraseña',
    desc: 'Elimina la contraseña y las restricciones de un PDF del que conoces la clave.',
    icon: 'unlock',
    color: '#12a594',
    section: 'seguridad',
    side: false,
    mount(ctx) {
        const load = async (list) => {
            const f = list[0];
            if (!f) return;
            const loaded = await UI.task('Abriendo PDF…', () => Engine.loadPdf(f));
            if (!loaded) return;
            if (!loaded.wasEncrypted) {
                ctx.body.replaceChildren(Comp.result({
                    title: 'Este PDF no tiene contraseña',
                    sub: `<b>${UI.esc(f.name)}</b> ya se puede abrir libremente. No hace falta desbloquearlo.`,
                    actions: [{ label: 'Elegir otro PDF', icon: 'file', primary: true, onClick: render }],
                }));
                ctx.body.querySelector('.rc-icon').innerHTML = icon('info');
                return;
            }
            Comp.finish(ctx, {
                out: { bytes: loaded.bytes, name: UI.baseName(f.name) + '_desbloqueado.pdf' },
                title: '¡Contraseña eliminada!',
                sub: loaded.password
                    ? `Se quitó la contraseña de apertura y todas las restricciones · ${UI.formatBytes(loaded.bytes.length)}`
                    : `Este PDF tenía restricciones (imprimir, copiar…). Se han eliminado · ${UI.formatBytes(loaded.bytes.length)}`,
                onBack: render,
                backLabel: 'Desbloquear otro',
            });
            ctx.body.querySelector('.rc-icon').innerHTML = icon('unlock');
        };

        const render = () => {
            const dz = Comp.dropzone({ title: 'Suelta el PDF protegido', sub: 'Te pediremos la contraseña si la necesita', multiple: false, color: ctx.tool.color, iconName: 'unlock', button: 'Elegir PDF', onFiles: load });
            const note = UI.el(`<div style="max-width:760px;margin:0 auto">${Comp.infoBox('Solo funciona si conoces la contraseña. Los PDF que únicamente tienen restricciones (no dejan imprimir o copiar) se desbloquean sin contraseña.')}</div>`);
            ctx.body.replaceChildren(dz, note);
        };

        const handoff = Tools.takeHandoff();
        render();
        if (handoff) load(handoff);
    },
});

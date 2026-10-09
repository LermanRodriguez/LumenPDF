/* Navegación entre herramientas y pantalla de inicio */
(function () {
    const app = document.getElementById('app');
    let cleanups = [];

    const SECTIONS = [
        { id: 'organizar', title: 'Organizar' },
        { id: 'editar', title: 'Editar y firmar' },
        { id: 'convertir', title: 'Convertir y optimizar' },
        { id: 'seguridad', title: 'Seguridad' },
    ];

    const renderHome = () => {
        document.title = 'LumenPDF';
        const home = UI.el(`<div class="home">
            <div class="hero">
                <h1>Todas tus herramientas PDF, sin subir nada</h1>
                <p>Une, divide, edita, firma, comprime y protege tus PDFs. Todo el procesamiento ocurre aquí, en tu dispositivo.</p>
                <div class="hero-pills">
                    <span class="pill">${icon('shield')}Privado: sin servidores</span>
                    <span class="pill">${icon('wifiOff')}Funciona sin internet</span>
                    <span class="pill">${icon('zap')}Sin límites de tamaño ni de archivos</span>
                </div>
            </div>
            ${SECTIONS.map((s) => `<h2 class="tool-section-title">${s.title}</h2>
                <div class="tool-grid">${Tools.list.filter((t) => t.section === s.id).map((t) => `
                    <a class="tool-card" href="#/${t.id}" style="--c:${t.color}">
                        <div class="tool-icon">${icon(t.icon)}</div>
                        <h3>${UI.esc(t.name)}</h3>
                        <p>${UI.esc(t.desc)}</p>
                    </a>`).join('')}</div>`).join('')}
        </div>`);
        app.replaceChildren(home);
    };

    const route = () => {
        cleanups.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
        cleanups = [];
        document.getElementById('modalRoot').replaceChildren();
        const id = location.hash.replace(/^#\/?/, '');
        const tool = Tools.list.find((t) => t.id === id);
        window.scrollTo(0, 0);
        if (!tool) return renderHome();
        document.title = `${tool.name} · LumenPDF`;
        const shell = Comp.shell(tool, { side: tool.side !== false });
        app.replaceChildren(shell.root);
        tool.mount({ ...shell, tool, onCleanup: (fn) => cleanups.push(fn) });
    };

    // Evita que soltar un archivo fuera de una zona válida haga que el navegador lo abra
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // Aviso si se intenta salir con trabajo sin guardar
    window.addEventListener('beforeunload', (e) => {
        if (window.Tools?.dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('footerYear').textContent = new Date().getFullYear();
    });

    window.addEventListener('hashchange', route);
    document.addEventListener('DOMContentLoaded', route);
})();

/** URL de un recurso copiado a /vendor durante la compilación (ver vite.config.ts). */
export function vendorUrl(path: string): string {
  return `${import.meta.env.BASE_URL}vendor/${path}`;
}

/** Carga un script clásico una sola vez. */
const loadedScripts = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  let promise = loadedScripts.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => {
        loadedScripts.delete(src);
        reject(new Error(`No se pudo cargar ${src}`));
      };
      document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
  }
  return promise;
}

/*
 * Paso de archivos entre herramientas ("Continuar con este PDF").
 * La herramienta de destino recoge los archivos al montarse.
 */
let pending: File[] | null = null;

export function setHandoff(files: File[]): void {
  pending = files;
}

/** Devuelve los archivos pendientes (una sola vez). */
export function takeHandoff(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}

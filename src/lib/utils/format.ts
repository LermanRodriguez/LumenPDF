/** Formatea un tamaño en bytes de forma legible (1.5 KB, 2.3 MB…). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb < 10 ? 2 : 1)} MB`;
}

/** "1 página" / "3 páginas" */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Nombre de archivo sin extensión. */
export function baseName(fileName: string): string {
  return (fileName || 'documento').replace(/\.[^.]+$/, '');
}

/** Garantiza que el nombre termine en .pdf (y no esté vacío). */
export function ensurePdfName(name: string, fallback = 'documento'): string {
  const clean = name.trim() || fallback;
  return /\.pdf$/i.test(clean) ? clean : `${clean}.pdf`;
}

/** Rellena con ceros a la izquierda según el total ("07" de "12"). */
export function padNumber(value: number, total: number): string {
  return String(value).padStart(String(total).length, '0');
}

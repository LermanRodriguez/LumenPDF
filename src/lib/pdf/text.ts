import type { PDFFont } from 'pdf-lib';

/**
 * Reemplaza por "?" los caracteres que una fuente estándar (WinAnsi) no puede dibujar
 * (emojis, otros alfabetos…). Los acentos y la ñ sí funcionan.
 */
export function toDrawableText(font: PDFFont, text: string): { text: string; replaced: boolean } {
  let output = '';
  let replaced = false;
  for (const char of text) {
    if (char === '\n') {
      output += char;
      continue;
    }
    try {
      font.encodeText(char);
      output += char;
    } catch {
      output += '?';
      replaced = true;
    }
  }
  return { text: output, replaced };
}

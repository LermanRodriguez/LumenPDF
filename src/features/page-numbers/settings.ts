import type { GridPosition } from '@/components/ui/controls';

export type NumberFormat = 'n' | 'page' | 'slash' | 'of' | 'dash';

export const NUMBER_FORMATS: Record<NumberFormat, { example: string; format: (n: number, total: number) => string }> = {
  n: { example: '1', format: (n) => `${n}` },
  page: { example: 'Página 1', format: (n) => `Página ${n}` },
  slash: { example: '1 / 10', format: (n, total) => `${n} / ${total}` },
  of: { example: 'Página 1 de 10', format: (n, total) => `Página ${n} de ${total}` },
  dash: { example: '- 1 -', format: (n) => `- ${n} -` },
};

/** Solo arriba o abajo (no en medio de la página). */
export const ALLOWED_POSITIONS: GridPosition[] = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];

export interface PageNumberSettings {
  position: GridPosition;
  format: NumberFormat;
  start: number;
  skipFirst: boolean;
  size: number;
  color: string;
  margin: number;
}

export const DEFAULT_SETTINGS: PageNumberSettings = {
  position: 'bc',
  format: 'n',
  start: 1,
  skipFirst: false,
  size: 11,
  color: '#333333',
  margin: 28,
};

/** Texto del número para la página `index`, o null si no se numera. */
export function labelForPage(index: number, pageCount: number, settings: PageNumberSettings): string | null {
  if (settings.skipFirst && index === 0) return null;
  const first = settings.skipFirst ? 1 : 0;
  const number = settings.start + (index - first);
  const total = settings.start + (pageCount - 1 - first);
  return NUMBER_FORMATS[settings.format].format(number, total);
}

/** Punto de la línea base del texto, en coordenadas visuales. */
export function labelAnchor(pageWidth: number, pageHeight: number, textWidth: number, settings: PageNumberSettings) {
  const { margin, size, position } = settings;
  const row = position[0];
  const column = position[1];
  const x = column === 'l' ? margin : column === 'r' ? pageWidth - margin - textWidth : (pageWidth - textWidth) / 2;
  const y = row === 't' ? margin + size * 0.72 : pageHeight - margin;
  return { x, y };
}

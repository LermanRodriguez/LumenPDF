import { rgb, type RGB } from 'pdf-lib';

/** Colores para distinguir archivos y grupos. */
export const ACCENT_COLORS = [
  '#e5484d', '#3b6fe0', '#2f9e5b', '#d68a00', '#8e4ec6',
  '#0894b3', '#d6409f', '#6e56cf', '#f76b15', '#12a594',
] as const;

export function colorAt(index: number): string {
  return ACCENT_COLORS[((index % ACCENT_COLORS.length) + ACCENT_COLORS.length) % ACCENT_COLORS.length];
}

/** "#rrggbb" → color de pdf-lib */
export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

import type { StandardFonts } from 'pdf-lib';
import type { PreparedImage } from '@/lib/pdf/images';
import { allPages, parseRanges } from '@/lib/pdf/ranges';

export type WatermarkFont = keyof Pick<typeof StandardFonts, 'HelveticaBold' | 'Helvetica' | 'TimesRomanBold' | 'CourierBold'>;

/** Fuentes del PDF y su equivalente CSS para la vista previa. */
export const WATERMARK_FONTS: Record<WatermarkFont, { label: string; css: (size: number) => string }> = {
  HelveticaBold: { label: 'Helvetica Negrita', css: (s) => `bold ${s}px Helvetica, Arial, sans-serif` },
  Helvetica: { label: 'Helvetica', css: (s) => `${s}px Helvetica, Arial, sans-serif` },
  TimesRomanBold: { label: 'Times Negrita', css: (s) => `bold ${s}px 'Times New Roman', serif` },
  CourierBold: { label: 'Courier Negrita', css: (s) => `bold ${s}px 'Courier New', monospace` },
};

export const WATERMARK_COLORS = ['#e5484d', '#111111', '#7a7a7a', '#1b4fd8', '#2f9e5b', '#d68a00'];

/** Imagen de la marca: datos para el PDF y elemento para la vista previa. */
export interface WatermarkImage extends PreparedImage {
  url: string;
  element: HTMLImageElement;
}

export interface WatermarkSettings {
  type: 'text' | 'image';
  text: string;
  font: WatermarkFont;
  size: number;
  color: string;
  /** 0–100 */
  opacity: number;
  /** Grados en sentido antihorario. */
  angle: number;
  layout: 'center' | 'tile';
  behindContent: boolean;
  pages: 'all' | 'range';
  rangeText: string;
  image: WatermarkImage | null;
  /** Ancho de la imagen como % del ancho de página. */
  imageScale: number;
}

export const DEFAULT_SETTINGS: WatermarkSettings = {
  type: 'text',
  text: 'CONFIDENCIAL',
  font: 'HelveticaBold',
  size: 60,
  color: '#e5484d',
  opacity: 30,
  angle: 45,
  layout: 'center',
  behindContent: false,
  pages: 'all',
  rangeText: '',
  image: null,
  imageScale: 40,
};

/** Páginas a las que se aplica la marca (índices base 0). */
export function resolveTargetPages(pageCount: number, settings: Pick<WatermarkSettings, 'pages' | 'rangeText'>) {
  if (settings.pages === 'all') return { pages: allPages(pageCount), error: null };
  const { groups, error } = parseRanges(settings.rangeText, pageCount);
  return { pages: [...new Set(groups.flat())], error };
}

/**
 * Centros (en coordenadas visuales) donde se dibuja la marca.
 * En mosaico se reparte por toda la página con filas desplazadas.
 */
export function watermarkPositions(
  pageWidth: number, pageHeight: number, itemWidth: number, itemHeight: number,
  { layout, angle }: Pick<WatermarkSettings, 'layout' | 'angle'>,
): Array<[number, number]> {
  if (layout === 'center') return [[pageWidth / 2, pageHeight / 2]];
  const a = (angle * Math.PI) / 180;
  // Caja que ocupa el elemento ya girado
  const boxW = Math.abs(itemWidth * Math.cos(a)) + Math.abs(itemHeight * Math.sin(a));
  const boxH = Math.abs(itemWidth * Math.sin(a)) + Math.abs(itemHeight * Math.cos(a));
  const stepX = boxW + Math.max(40, pageWidth * 0.08);
  const stepY = boxH + Math.max(40, pageHeight * 0.08);
  const positions: Array<[number, number]> = [];
  let row = 0;
  for (let y = stepY / 2; y < pageHeight + stepY; y += stepY, row++) {
    for (let x = row % 2 ? stepX / 2 : 0; x < pageWidth + stepX; x += stepX) positions.push([x, y]);
  }
  return positions;
}

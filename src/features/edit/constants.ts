import type { StandardFonts } from 'pdf-lib';
import type { IconName } from '@/components/ui/Icon';
import type { FontKey, StyleDefaults, ToolMode } from './types';

/** Interlineado del texto (igual en pantalla y en el PDF). */
export const LINE_HEIGHT = 1.2;

type StandardFontName = keyof typeof StandardFonts;

interface FontInfo {
  label: string;
  css: string;
  /** Distancia de la parte superior de la línea a la línea base (fracción del tamaño). */
  baseline: number;
  /** Variantes: normal, negrita, cursiva, negrita cursiva. */
  pdf: Record<'n' | 'b' | 'i' | 'bi', StandardFontName>;
}

/** Fuentes estándar del PDF y su equivalente en pantalla. */
export const FONTS: Record<FontKey, FontInfo> = {
  helvetica: { label: 'Helvetica', css: 'Helvetica, Arial, sans-serif', baseline: 0.947, pdf: { n: 'Helvetica', b: 'HelveticaBold', i: 'HelveticaOblique', bi: 'HelveticaBoldOblique' } },
  times: { label: 'Times', css: "'Times New Roman', Times, serif", baseline: 0.9375, pdf: { n: 'TimesRoman', b: 'TimesRomanBold', i: 'TimesRomanItalic', bi: 'TimesRomanBoldItalic' } },
  courier: { label: 'Courier', css: "'Courier New', Courier, monospace", baseline: 0.866, pdf: { n: 'Courier', b: 'CourierBold', i: 'CourierOblique', bi: 'CourierBoldOblique' } },
};

export const PALETTE = ['#111111', '#ffffff', '#e5484d', '#f76b15', '#ffe14d', '#2f9e5b', '#1b4fd8', '#8e4ec6'];
export const HIGHLIGHT_PALETTE = ['#ffe14d', '#7ee787', '#7cc4ff', '#ff9ecf', '#ffb35c'];
export const SIGNATURE_COLORS = ['#111111', '#1b4fd8', '#0d3a8c', '#c9363b'];

export const DEFAULT_STYLES: StyleDefaults = {
  text: { font: 'helvetica', size: 16, color: '#111111', bold: false, italic: false, opacity: 1 },
  rect: { stroke: '#e5484d', fill: '', strokeWidth: 2, opacity: 1 },
  ellipse: { stroke: '#e5484d', fill: '', strokeWidth: 2, opacity: 1 },
  line: { stroke: '#e5484d', strokeWidth: 3, opacity: 1 },
  draw: { stroke: '#1b4fd8', strokeWidth: 3, opacity: 1 },
  highlight: { fill: '#ffe14d', opacity: 0.45 },
  whiteout: { fill: '#ffffff', opacity: 1 },
  image: { opacity: 1 },
};

/** Tamaño por defecto (en puntos) si se hace clic sin arrastrar. */
export const DEFAULT_BOX: Record<'highlight' | 'line' | 'whiteout' | 'rect' | 'ellipse', [number, number]> = {
  highlight: [140, 18],
  line: [120, 0],
  whiteout: [120, 30],
  rect: [120, 80],
  ellipse: [120, 80],
};

export type ToolbarAction = 'signature' | 'image' | 'check' | 'cross' | 'date';

export type ToolbarEntry =
  | { type: 'mode'; mode: ToolMode; label: string; icon: IconName }
  | { type: 'action'; action: ToolbarAction; label: string; icon: IconName }
  | { type: 'separator' };

export const TOOLBAR: ToolbarEntry[] = [
  { type: 'mode', mode: 'select', label: 'Mover', icon: 'cursor' },
  { type: 'mode', mode: 'text', label: 'Texto', icon: 'text' },
  { type: 'action', action: 'signature', label: 'Firma', icon: 'signature' },
  { type: 'action', action: 'image', label: 'Imagen', icon: 'image' },
  { type: 'separator' },
  { type: 'mode', mode: 'highlight', label: 'Resaltar', icon: 'highlighter' },
  { type: 'mode', mode: 'draw', label: 'Dibujar', icon: 'pencil' },
  { type: 'mode', mode: 'rect', label: 'Rectángulo', icon: 'square' },
  { type: 'mode', mode: 'ellipse', label: 'Círculo', icon: 'circle' },
  { type: 'mode', mode: 'line', label: 'Línea', icon: 'line' },
  { type: 'mode', mode: 'whiteout', label: 'Tapar', icon: 'eraser' },
  { type: 'separator' },
  { type: 'action', action: 'check', label: 'Marca ✓', icon: 'check' },
  { type: 'action', action: 'cross', label: 'Marca ✗', icon: 'x' },
  { type: 'action', action: 'date', label: 'Fecha', icon: 'calendar' },
];

export const MODE_HELP: Partial<Record<ToolMode, string>> = {
  select: 'Haz clic en un elemento para seleccionarlo. Arrástralo para moverlo y usa las esquinas para cambiar su tamaño. Doble clic en un texto para editarlo.',
  text: 'Haz clic en cualquier lugar de la página para escribir.',
  highlight: 'Arrastra sobre la zona que quieres resaltar.',
  draw: 'Dibuja a mano alzada sobre la página.',
  rect: 'Arrastra para dibujar un rectángulo.',
  ellipse: 'Arrastra para dibujar un círculo u óvalo.',
  line: 'Arrastra para dibujar una línea.',
  whiteout: 'Arrastra para cubrir una zona con un recuadro (por defecto blanco). Ojo: tapa visualmente, pero el texto original sigue existiendo debajo.',
};

export const KIND_LABELS: Record<string, string> = {
  text: 'Texto', image: 'Imagen', rect: 'Rectángulo', ellipse: 'Círculo',
  line: 'Línea', draw: 'Dibujo', highlight: 'Resaltado', whiteout: 'Tapar',
};

/** Marcas predefinidas (trazos normalizados). */
export const STAMPS = {
  check: { strokes: [[[0, 0.55], [0.36, 0.95], [1, 0.05]]] as Array<Array<[number, number]>>, color: '#2f9e5b' },
  cross: { strokes: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]] as Array<Array<[number, number]>>, color: '#e5484d' },
};

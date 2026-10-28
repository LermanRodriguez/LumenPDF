/*
 * Los objetos del editor se guardan en "unidades de página": puntos de la página
 * tal como se ve (rotación aplicada), con origen arriba a la izquierda.
 * En pantalla se multiplican por el zoom; al guardar se convierten a coordenadas PDF.
 */

export type FontKey = 'helvetica' | 'times' | 'courier';

interface ObjectBase {
  id: number;
  /** Índice de la página (base 0). */
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 0–1 */
  opacity: number;
}

export interface TextObject extends ObjectBase {
  kind: 'text';
  text: string;
  font: FontKey;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface ImageObject extends ObjectBase {
  kind: 'image';
  /** data:image/png o data:image/jpeg */
  src: string;
}

export interface ShapeObject extends ObjectBase {
  kind: 'rect' | 'ellipse';
  /** '' = sin borde */
  stroke: string;
  /** '' = sin relleno */
  fill: string;
  strokeWidth: number;
}

export interface LineObject extends ObjectBase {
  kind: 'line';
  stroke: string;
  strokeWidth: number;
  /** false: de arriba-izquierda a abajo-derecha; true: de abajo-izquierda a arriba-derecha. */
  flipped: boolean;
}

export interface DrawObject extends ObjectBase {
  kind: 'draw';
  stroke: string;
  strokeWidth: number;
  /** Trazos con puntos normalizados (0–1) dentro de la caja del objeto. */
  strokes: Array<Array<[number, number]>>;
}

export interface FillObject extends ObjectBase {
  kind: 'highlight' | 'whiteout';
  fill: string;
}

export type EditorObject = TextObject | ImageObject | ShapeObject | LineObject | DrawObject | FillObject;
export type ObjectKind = EditorObject['kind'];

/** Herramientas que se usan haciendo clic o arrastrando sobre la página. */
export type ToolMode = 'select' | 'text' | 'highlight' | 'draw' | 'rect' | 'ellipse' | 'line' | 'whiteout';

/** Herramientas que crean una caja arrastrando. */
export type BoxMode = Extract<ToolMode, 'highlight' | 'rect' | 'ellipse' | 'line' | 'whiteout'>;

/** Estilo que se aplica a los objetos nuevos de cada tipo. */
export interface StyleDefaults {
  text: Pick<TextObject, 'font' | 'size' | 'color' | 'bold' | 'italic' | 'opacity'>;
  rect: Pick<ShapeObject, 'stroke' | 'fill' | 'strokeWidth' | 'opacity'>;
  ellipse: Pick<ShapeObject, 'stroke' | 'fill' | 'strokeWidth' | 'opacity'>;
  line: Pick<LineObject, 'stroke' | 'strokeWidth' | 'opacity'>;
  draw: Pick<DrawObject, 'stroke' | 'strokeWidth' | 'opacity'>;
  highlight: Pick<FillObject, 'fill' | 'opacity'>;
  whiteout: Pick<FillObject, 'fill' | 'opacity'>;
  image: Pick<ImageObject, 'opacity'>;
}

/** Imagen de firma lista para insertar. */
export interface SignatureImage {
  src: string;
  width: number;
  height: number;
}

/** Esquina desde la que se redimensiona. */
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

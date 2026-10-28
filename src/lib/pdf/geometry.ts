/*
 * Dibujo en "coordenadas visuales": puntos con origen arriba-izquierda,
 * tal como se ve la página (con su rotación). Así lo que el usuario ve
 * en pantalla coincide con lo que se escribe en el PDF, aunque la página esté girada.
 */
import { degrees, popGraphicsState, pushGraphicsState, type PDFDocument, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { PageViewport } from 'pdfjs-dist';
import { getPdfJsDocument } from './pdfjs';
import type { PdfFile } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface VisualFrame {
  width: number;
  height: number;
  /** Convierte un punto visual a coordenadas PDF. */
  toPdf(x: number, y: number): Point;
  /** Rotación (grados) que hay que aplicar para que algo se vea derecho. */
  rotation: number;
}

export function frameFromViewport(viewport: PageViewport): VisualFrame {
  const toPdf = (x: number, y: number): Point => {
    const [px, py] = viewport.convertToPdfPoint(x, y) as [number, number];
    return { x: px, y: py };
  };
  const origin = toPdf(0, 0);
  const unitX = toPdf(1, 0);
  return {
    width: viewport.width,
    height: viewport.height,
    toPdf,
    rotation: (Math.atan2(unitX.y - origin.y, unitX.x - origin.x) * 180) / Math.PI,
  };
}

export async function getVisualFrame(file: PdfFile, index: number): Promise<VisualFrame> {
  const page = await (await getPdfJsDocument(file)).getPage(index + 1);
  return frameFromViewport(page.getViewport({ scale: 1 }));
}

/**
 * Envuelve el contenido original en q/Q para que lo que se dibuje después
 * no herede transformaciones sueltas del PDF. Llamar antes de dibujar.
 */
export function isolatePage(doc: PDFDocument, page: PDFPage): void {
  page.node.normalize();
  // createContentStream es interno en los tipos de pdf-lib, pero estable en la versión 1.17
  const internal = page as unknown as { createContentStream(...ops: unknown[]): never };
  const start = internal.createContentStream(pushGraphicsState());
  const end = internal.createContentStream(popGraphicsState());
  page.node.wrapContentStreams(doc.context.register(start), doc.context.register(end));
}

/** Mueve lo último dibujado por pdf-lib detrás del contenido original. */
export function sendDrawingToBack(page: PDFPage): void {
  const contents = page.node.Contents();
  const ref = (page as unknown as { contentStreamRef?: unknown }).contentStreamRef;
  if (!contents || !('asArray' in contents) || !ref) return;
  const index = contents.asArray().findIndex((item) => item === ref);
  if (index > 0) {
    contents.remove(index);
    contents.insert(0, ref as never);
  }
}

export interface CenteredTextOptions {
  cx: number;
  cy: number;
  /** Grados en sentido antihorario. */
  angle?: number;
  size: number;
  font: PDFFont;
  color: RGB;
  opacity?: number;
}

/** Dibuja texto centrado en un punto visual, girado `angle` grados. */
export function drawTextCentered(page: PDFPage, frame: VisualFrame, text: string, options: CenteredTextOptions): void {
  const { cx, cy, angle = 0, size, font, color, opacity = 1 } = options;
  const width = font.widthOfTextAtSize(text, size);
  const capHeight = font.heightAtSize(size, { descender: false }) * 0.72;
  const start = rotatedCorner(cx, cy, angle, -width / 2, -capHeight / 2);
  const point = frame.toPdf(start.x, start.y);
  page.drawText(text, { x: point.x, y: point.y, size, font, color, opacity, rotate: degrees(frame.rotation + angle) });
}

/**
 * Punto visual desplazado (along, up) desde un centro, en un sistema girado `angle` grados.
 * `along` sigue la dirección del texto; `up` es perpendicular hacia "arriba".
 */
export function rotatedCorner(cx: number, cy: number, angle: number, along: number, up: number): Point {
  const a = (angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = -Math.sin(a);   // dirección (eje y visual hacia abajo)
  const vx = -Math.sin(a), vy = -Math.cos(a);  // "arriba"
  return { x: cx + ux * along + vx * up, y: cy + uy * along + vy * up };
}

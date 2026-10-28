/* Escribe los objetos del editor dentro del PDF. */
import { BlendMode, degrees, LineCapStyle, StandardFonts, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { PageViewport } from 'pdfjs-dist';
import { loadEditableDocument, savePdf } from '@/lib/pdf/document';
import { frameFromViewport, isolatePage, type VisualFrame } from '@/lib/pdf/geometry';
import { dataUrlToBytes } from '@/lib/pdf/images';
import { toDrawableText } from '@/lib/pdf/text';
import type { PdfFile } from '@/lib/pdf/types';
import { hexToRgb } from '@/lib/utils/colors';
import { FONTS, LINE_HEIGHT } from './constants';
import type { EditorObject, TextObject } from './types';

export interface ExportResult {
  bytes: Uint8Array;
  /** Algún carácter no se pudo dibujar con las fuentes estándar. */
  replacedChars: boolean;
}

/** Recursos incrustados una sola vez aunque se usen en varias páginas. */
class ResourceCache {
  private readonly doc: PDFDocument;
  private readonly fonts = new Map<string, PDFFont>();
  private readonly images = new Map<string, PDFImage>();

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  async font(object: TextObject): Promise<PDFFont> {
    const variant = object.bold && object.italic ? 'bi' : object.bold ? 'b' : object.italic ? 'i' : 'n';
    const name = FONTS[object.font].pdf[variant];
    let font = this.fonts.get(name);
    if (!font) {
      font = await this.doc.embedFont(StandardFonts[name]);
      this.fonts.set(name, font);
    }
    return font;
  }

  async image(src: string): Promise<PDFImage> {
    let image = this.images.get(src);
    if (!image) {
      const bytes = dataUrlToBytes(src);
      image = src.startsWith('data:image/jpeg') ? await this.doc.embedJpg(bytes) : await this.doc.embedPng(bytes);
      this.images.set(src, image);
    }
    return image;
  }
}

export async function exportPdf(file: PdfFile, objects: EditorObject[], viewports: PageViewport[]): Promise<ExportResult> {
  const doc = await loadEditableDocument(file);
  const pages = doc.getPages();
  const resources = new ResourceCache(doc);
  let replacedChars = false;

  const pageIndices = [...new Set(objects.map((o) => o.page))];
  for (const pageIndex of pageIndices) {
    const page = pages[pageIndex];
    const frame = frameFromViewport(viewports[pageIndex]);
    isolatePage(doc, page);
    for (const object of objects.filter((o) => o.page === pageIndex)) {
      replacedChars = (await drawObject(page, frame, object, resources)) || replacedChars;
    }
  }
  return { bytes: await savePdf(doc), replacedChars };
}

/** Dibuja un objeto. Devuelve true si se reemplazaron caracteres. */
async function drawObject(page: PDFPage, frame: VisualFrame, object: EditorObject, resources: ResourceCache): Promise<boolean> {
  const { toPdf } = frame;
  const rotate = degrees(frame.rotation);
  const { x, y, w, h, opacity } = object;
  // Esquina inferior izquierda tal como se ve: origen de rectángulos e imágenes
  const bottomLeft = toPdf(x, y + h);

  switch (object.kind) {
    case 'text': {
      const font = await resources.font(object);
      let replaced = false;
      object.text.split('\n').forEach((line, i) => {
        const drawable = toDrawableText(font, line);
        replaced ||= drawable.replaced;
        if (!drawable.text) return;
        const baseline = toPdf(x, y + i * object.size * LINE_HEIGHT + FONTS[object.font].baseline * object.size);
        page.drawText(drawable.text, { x: baseline.x, y: baseline.y, size: object.size, font, color: hexToRgb(object.color), rotate, opacity });
      });
      return replaced;
    }
    case 'image':
      page.drawImage(await resources.image(object.src), { ...bottomLeft, width: w, height: h, rotate, opacity });
      return false;
    case 'rect':
      page.drawRectangle({
        ...bottomLeft, width: w, height: h, rotate,
        color: object.fill ? hexToRgb(object.fill) : undefined, opacity,
        borderColor: object.stroke ? hexToRgb(object.stroke) : undefined, borderWidth: object.stroke ? object.strokeWidth : 0, borderOpacity: opacity,
      });
      return false;
    case 'ellipse': {
      const center = toPdf(x + w / 2, y + h / 2);
      page.drawEllipse({
        ...center, xScale: w / 2, yScale: h / 2, rotate,
        color: object.fill ? hexToRgb(object.fill) : undefined, opacity,
        borderColor: object.stroke ? hexToRgb(object.stroke) : undefined, borderWidth: object.stroke ? object.strokeWidth : 0, borderOpacity: opacity,
      });
      return false;
    }
    case 'highlight':
      page.drawRectangle({ ...bottomLeft, width: w, height: h, rotate, color: hexToRgb(object.fill), opacity, blendMode: BlendMode.Multiply });
      return false;
    case 'whiteout':
      page.drawRectangle({ ...bottomLeft, width: w, height: h, rotate, color: hexToRgb(object.fill) });
      return false;
    case 'line': {
      const [start, end] = object.flipped ? [toPdf(x, y + h), toPdf(x + w, y)] : [toPdf(x, y), toPdf(x + w, y + h)];
      page.drawLine({ start, end, thickness: object.strokeWidth, color: hexToRgb(object.stroke), opacity, lineCap: LineCapStyle.Round });
      return false;
    }
    case 'draw': {
      // Ruta SVG ya en coordenadas PDF (pdf-lib invierte el eje Y de las rutas SVG)
      const path = object.strokes.map((stroke) => stroke.map(([px, py], i) => {
        const point = toPdf(x + px * w, y + py * h);
        return `${i ? 'L' : 'M'}${point.x.toFixed(2)} ${(-point.y).toFixed(2)}`;
      }).join(' ')).join(' ');
      page.drawSvgPath(path, { x: 0, y: 0, borderColor: hexToRgb(object.stroke), borderWidth: object.strokeWidth, borderOpacity: opacity, borderLineCap: LineCapStyle.Round });
      return false;
    }
  }
}

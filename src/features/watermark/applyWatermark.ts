import { degrees, StandardFonts } from 'pdf-lib';
import { loadEditableDocument, savePdf } from '@/lib/pdf/document';
import { drawTextCentered, getVisualFrame, isolatePage, rotatedCorner, sendDrawingToBack } from '@/lib/pdf/geometry';
import { embedImage } from '@/lib/pdf/images';
import { toDrawableText } from '@/lib/pdf/text';
import type { PdfFile } from '@/lib/pdf/types';
import { hexToRgb } from '@/lib/utils/colors';
import { watermarkPositions, type WatermarkSettings } from './settings';

export interface WatermarkResult {
  bytes: Uint8Array;
  /** Se reemplazaron caracteres no compatibles con la fuente. */
  replacedChars: boolean;
}

export async function applyWatermark(
  file: PdfFile, pageIndices: number[], settings: WatermarkSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<WatermarkResult> {
  const doc = await loadEditableDocument(file);
  const pages = doc.getPages();
  const opacity = settings.opacity / 100;

  const font = settings.type === 'text' ? await doc.embedFont(StandardFonts[settings.font]) : null;
  const image = settings.type === 'image' && settings.image ? await embedImage(doc, settings.image) : null;
  const drawable = font ? toDrawableText(font, settings.text) : { text: '', replaced: false };

  for (const [k, index] of pageIndices.entries()) {
    onProgress?.(k, pageIndices.length);
    const page = pages[index];
    const frame = await getVisualFrame(file, index);
    isolatePage(doc, page);

    if (font) {
      const width = font.widthOfTextAtSize(drawable.text, settings.size);
      for (const [cx, cy] of watermarkPositions(frame.width, frame.height, width, settings.size, settings)) {
        drawTextCentered(page, frame, drawable.text, { cx, cy, angle: settings.angle, size: settings.size, font, color: hexToRgb(settings.color), opacity });
      }
    } else if (image && settings.image) {
      const width = (frame.width * settings.imageScale) / 100;
      const height = (width * settings.image.height) / settings.image.width;
      for (const [cx, cy] of watermarkPositions(frame.width, frame.height, width, height, settings)) {
        const corner = rotatedCorner(cx, cy, settings.angle, -width / 2, -height / 2);
        const point = frame.toPdf(corner.x, corner.y);
        page.drawImage(image, { x: point.x, y: point.y, width, height, opacity, rotate: degrees(frame.rotation + settings.angle) });
      }
    }
    if (settings.behindContent) sendDrawingToBack(page);
  }
  return { bytes: await savePdf(doc), replacedChars: drawable.replaced };
}

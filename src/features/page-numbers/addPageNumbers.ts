import { degrees, StandardFonts } from 'pdf-lib';
import { loadEditableDocument, savePdf } from '@/lib/pdf/document';
import { getVisualFrame, isolatePage } from '@/lib/pdf/geometry';
import type { PdfFile } from '@/lib/pdf/types';
import { hexToRgb } from '@/lib/utils/colors';
import { labelAnchor, labelForPage, type PageNumberSettings } from './settings';

export async function addPageNumbers(
  file: PdfFile, settings: PageNumberSettings,
  onProgress?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; numbered: number }> {
  const doc = await loadEditableDocument(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexToRgb(settings.color);
  const pages = doc.getPages();
  let numbered = 0;

  for (const [index, page] of pages.entries()) {
    onProgress?.(index, pages.length);
    const label = labelForPage(index, pages.length, settings);
    if (!label) continue;
    const frame = await getVisualFrame(file, index);
    const width = font.widthOfTextAtSize(label, settings.size);
    const anchor = labelAnchor(frame.width, frame.height, width, settings);
    const point = frame.toPdf(anchor.x, anchor.y);
    isolatePage(doc, page);
    page.drawText(label, { x: point.x, y: point.y, size: settings.size, font, color, rotate: degrees(frame.rotation) });
    numbered++;
  }
  return { bytes: await savePdf(doc), numbered };
}

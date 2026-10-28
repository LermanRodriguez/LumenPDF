import { createDocument, savePdf } from '@/lib/pdf/document';
import { embedImage, prepareImage, rotateImage } from '@/lib/pdf/images';

export type PageSizeOption = 'a4' | 'letter' | 'legal' | 'fit';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type MarginOption = 'none' | 'small' | 'big';

export const PAGE_SIZES: Record<PageSizeOption, { label: string; size: [number, number] | null }> = {
  a4: { label: 'A4', size: [595.28, 841.89] },
  letter: { label: 'Carta', size: [612, 792] },
  legal: { label: 'Oficio', size: [612, 1008] },
  fit: { label: 'Igual a la imagen', size: null },
};

export const MARGINS: Record<MarginOption, { label: string; points: number }> = {
  none: { label: 'Sin margen', points: 0 },
  small: { label: 'Pequeño', points: 20 },
  big: { label: 'Grande', points: 50 },
};

export interface ImageEntry {
  file: File;
  /** Rotación en grados, sentido horario. */
  rotation: number;
}

export interface ImagesToPdfOptions {
  pageSize: PageSizeOption;
  orientation: Orientation;
  margin: MarginOption;
}

/** Una imagen por página, centrada y ajustada al área útil. */
export async function imagesToPdf(images: ImageEntry[], options: ImagesToPdfOptions, onProgress?: (done: number, total: number) => void) {
  const doc = await createDocument();
  const margin = MARGINS[options.margin].points;

  for (const [i, entry] of images.entries()) {
    onProgress?.(i, images.length);
    let image = await prepareImage(entry.file);
    if (entry.rotation) image = await rotateImage(image, entry.rotation);
    const embedded = await embedImage(doc, image);

    let pageWidth: number, pageHeight: number;
    const preset = PAGE_SIZES[options.pageSize].size;
    if (!preset) {
      // 1 píxel = 0,75 puntos (96 ppp), con el margen alrededor
      pageWidth = image.width * 0.75 + margin * 2;
      pageHeight = image.height * 0.75 + margin * 2;
    } else {
      [pageWidth, pageHeight] = preset;
      const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && image.width > image.height);
      if (landscape) [pageWidth, pageHeight] = [pageHeight, pageWidth];
    }

    const page = doc.addPage([pageWidth, pageHeight]);
    const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
  }
  return savePdf(doc);
}

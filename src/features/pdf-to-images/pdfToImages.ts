import { renderPage } from '@/lib/pdf/render';
import type { PdfFile } from '@/lib/pdf/types';
import { canvasToBlob } from '@/lib/utils/files';
import { baseName, padNumber } from '@/lib/utils/format';

export type ImageFormat = 'jpg' | 'png';

export interface ExportOptions {
  format: ImageFormat;
  dpi: number;
  /** Calidad JPG, 0–100. */
  quality: number;
}

export interface ExportedImage {
  name: string;
  blob: Blob;
}

interface Progress {
  setText(text: string): void;
  setProgress(done: number, total: number): void;
}

export async function pdfToImages(file: PdfFile, pageIndices: number[], options: ExportOptions, progress: Progress): Promise<ExportedImage[]> {
  const mime = options.format === 'jpg' ? 'image/jpeg' : 'image/png';
  const base = baseName(file.name);
  const images: ExportedImage[] = [];
  for (const [k, index] of pageIndices.entries()) {
    progress.setText(`Página ${index + 1} (${k + 1} de ${pageIndices.length})…`);
    progress.setProgress(k, pageIndices.length);
    const { canvas } = await renderPage(file, index, { scale: options.dpi / 72, intent: 'print' });
    const blob = await canvasToBlob(canvas, mime, options.quality / 100);
    canvas.width = canvas.height = 0; // libera memoria
    images.push({ name: `${base}_pagina${padNumber(index + 1, file.pageCount)}.${options.format}`, blob });
  }
  return images;
}

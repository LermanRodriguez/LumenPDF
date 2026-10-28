import { createDocument, loadEditableDocument, savePdf } from '@/lib/pdf/document';
import { optimizePdf } from '@/lib/pdf/qpdf';
import { renderPage } from '@/lib/pdf/render';
import type { PdfFile } from '@/lib/pdf/types';
import { canvasToBlob, readFileBytes } from '@/lib/utils/files';

export type CompressionLevel = 'lossless' | 'recommended' | 'maximum';

/** Resolución y calidad JPEG para los niveles que convierten páginas a imagen. */
const RASTER_SETTINGS: Record<Exclude<CompressionLevel, 'lossless'>, { dpi: number; quality: number }> = {
  recommended: { dpi: 150, quality: 0.72 },
  maximum: { dpi: 96, quality: 0.55 },
};

interface Progress {
  setText(text: string): void;
  setProgress(done: number, total: number): void;
}

export async function compressPdf(file: PdfFile, level: CompressionLevel, progress: Progress): Promise<Uint8Array> {
  if (level === 'lossless') {
    progress.setText('Optimizando estructura…');
    // pdf-lib reescribe con flujos de objetos y luego qpdf recomprime
    const rewritten = await savePdf(await loadEditableDocument(file));
    return optimizePdf(rewritten);
  }

  const { dpi, quality } = RASTER_SETTINGS[level];
  const output = await createDocument();
  for (let i = 0; i < file.pageCount; i++) {
    progress.setText(`Procesando página ${i + 1} de ${file.pageCount}…`);
    progress.setProgress(i, file.pageCount);
    const { canvas, viewport } = await renderPage(file, i, { scale: dpi / 72, intent: 'print' });
    const jpg = await output.embedJpg(await readFileBytes(await canvasToBlob(canvas, 'image/jpeg', quality)));
    const width = viewport.width / (dpi / 72);
    const height = viewport.height / (dpi / 72);
    output.addPage([width, height]).drawImage(jpg, { x: 0, y: 0, width, height });
    canvas.width = canvas.height = 0; // libera memoria
  }
  return savePdf(output);
}

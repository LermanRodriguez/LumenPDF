import { degrees, type PDFPage } from 'pdf-lib';
import { createDocument, getLibDocument, savePdf } from '@/lib/pdf/document';
import type { PdfFile } from '@/lib/pdf/types';
import type { PageItem, SourcePageItem } from './types';

/** Construye un PDF nuevo con las páginas en el orden y rotación indicados. */
export async function buildDocument(items: PageItem[], onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const output = await createDocument();

  // Se copian las páginas agrupadas por archivo para no duplicar recursos compartidos (fuentes, imágenes…)
  const byFile = new Map<PdfFile, SourcePageItem[]>();
  for (const item of items) {
    if (item.kind === 'page') byFile.set(item.file, [...(byFile.get(item.file) ?? []), item]);
  }

  const copied = new Map<number, PDFPage>();
  let done = 0;
  for (const [file, fileItems] of byFile) {
    const source = await getLibDocument(file);
    // pdf-lib devuelve la misma página si se copia dos veces en una llamada:
    // la primera aparición se copia en lote y las repeticiones por separado.
    const seen = new Set<number>();
    const firstCopies = fileItems.filter((item) => !seen.has(item.index) && seen.add(item.index));
    const repeats = fileItems.filter((item) => !firstCopies.includes(item));

    const pages = await output.copyPages(source, firstCopies.map((item) => item.index));
    firstCopies.forEach((item, i) => copied.set(item.uid, pages[i]));
    for (const item of repeats) {
      const [page] = await output.copyPages(source, [item.index]);
      copied.set(item.uid, page);
    }
    onProgress?.(++done, byFile.size);
  }

  for (const item of items) {
    const page = item.kind === 'blank' ? output.addPage([item.width, item.height]) : output.addPage(copied.get(item.uid)!);
    if (item.rotation) {
      const current = page.getRotation().angle || 0;
      page.setRotation(degrees((((current + item.rotation) % 360) + 360) % 360));
    }
  }
  return savePdf(output);
}

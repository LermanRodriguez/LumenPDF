import { createDocument, getLibDocument, savePdf } from '@/lib/pdf/document';
import type { PdfFile } from '@/lib/pdf/types';

export interface MergeOptions {
  /** Añade una página en blanco tras los documentos con páginas impares (impresión a doble cara). */
  blankAfterOddDocuments: boolean;
  onProgress?: (done: number, total: number) => void;
}

export async function mergePdfs(files: PdfFile[], { blankAfterOddDocuments, onProgress }: MergeOptions) {
  const output = await createDocument();
  for (const [i, file] of files.entries()) {
    onProgress?.(i, files.length);
    const source = await getLibDocument(file);
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));

    const isLast = i === files.length - 1;
    if (blankAfterOddDocuments && pages.length % 2 === 1 && !isLast) {
      const { width, height } = pages[pages.length - 1].getSize();
      output.addPage([width, height]);
    }
  }
  onProgress?.(files.length, files.length);
  return { bytes: await savePdf(output), pageCount: output.getPageCount() };
}

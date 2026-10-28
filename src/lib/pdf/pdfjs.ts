/* pdf.js: lectura y renderizado de PDFs. */
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { vendorUrl } from '@/lib/utils/assets';
import type { PdfFile } from './types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdfJs(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  return pdfjsLib.getDocument({
    data: bytes.slice(), // pdf.js se queda con el buffer: se le pasa una copia
    password,
    isEvalSupported: false,
    cMapUrl: vendorUrl('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: vendorUrl('pdfjs/standard_fonts/'),
    useSystemFonts: true,
  }).promise;
}

const documents = new WeakMap<PdfFile, Promise<PDFDocumentProxy>>();

/** Documento de pdf.js asociado a un archivo (se abre una sola vez). */
export function getPdfJsDocument(file: PdfFile): Promise<PDFDocumentProxy> {
  let doc = documents.get(file);
  if (!doc) {
    doc = openPdfJs(file.bytes);
    documents.set(file, doc);
  }
  return doc;
}

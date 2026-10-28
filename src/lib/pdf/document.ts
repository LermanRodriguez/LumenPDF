/* pdf-lib: creación y modificación de PDFs. */
import { PDFDocument } from 'pdf-lib';
import type { PdfFile } from './types';

const documents = new WeakMap<PdfFile, Promise<PDFDocument>>();

/**
 * Documento de pdf-lib en caché, para LEER o copiar páginas.
 * No lo modifiques: usa `loadEditableDocument` para eso.
 */
export function getLibDocument(file: PdfFile): Promise<PDFDocument> {
  let doc = documents.get(file);
  if (!doc) {
    doc = PDFDocument.load(file.bytes, { updateMetadata: false });
    documents.set(file, doc);
  }
  return doc;
}

/** Copia nueva del documento, lista para modificar. */
export function loadEditableDocument(file: PdfFile): Promise<PDFDocument> {
  return PDFDocument.load(file.bytes, { updateMetadata: false });
}

/** Documento vacío con los datos de la aplicación. */
export async function createDocument(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer('LumenPDF (local)');
  doc.setCreator('LumenPDF');
  return doc;
}

export function savePdf(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

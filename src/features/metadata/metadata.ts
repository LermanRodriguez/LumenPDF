import { PDFName } from 'pdf-lib';
import { loadEditableDocument } from '@/lib/pdf/document';
import { getPageSize } from '@/lib/pdf/render';
import type { PdfFile } from '@/lib/pdf/types';

export interface EditableMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export interface DocumentInfo {
  version: string;
  created: string;
  modified: string;
  /** Tamaño de la primera página en milímetros. */
  pageSize: string;
  hasXmp: boolean;
}

const formatDate = (date?: Date) => (date ? date.toLocaleString('es') : '—');
const POINTS_TO_MM = 25.4 / 72;

export async function readMetadata(file: PdfFile): Promise<{ metadata: EditableMetadata; info: DocumentInfo }> {
  const doc = await loadEditableDocument(file);
  const header = new TextDecoder('latin1').decode(file.bytes.subarray(0, 16)).match(/%PDF-(\d\.\d)/);
  const size = await getPageSize(file, 0);
  return {
    metadata: {
      title: doc.getTitle() ?? '',
      author: doc.getAuthor() ?? '',
      subject: doc.getSubject() ?? '',
      keywords: doc.getKeywords() ?? '',
      creator: doc.getCreator() ?? '',
      producer: doc.getProducer() ?? '',
    },
    info: {
      version: header?.[1] ?? '—',
      created: formatDate(doc.getCreationDate()),
      modified: formatDate(doc.getModificationDate()),
      pageSize: `${Math.round(size.width * POINTS_TO_MM)} × ${Math.round(size.height * POINTS_TO_MM)} mm`,
      hasXmp: !!doc.catalog.get(PDFName.of('Metadata')),
    },
  };
}

export async function writeMetadata(file: PdfFile, metadata: EditableMetadata): Promise<Uint8Array> {
  const doc = await loadEditableDocument(file);
  doc.setTitle(metadata.title);
  doc.setAuthor(metadata.author);
  doc.setSubject(metadata.subject);
  doc.setKeywords(metadata.keywords.split(/[,;]\s*/).filter(Boolean));
  doc.setCreator(metadata.creator);
  doc.setProducer(metadata.producer);
  doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}

/** Elimina el diccionario Info y el flujo XMP. */
export async function removeMetadata(file: PdfFile): Promise<Uint8Array> {
  const doc = await loadEditableDocument(file);
  doc.catalog.delete(PDFName.of('Metadata'));
  const infoRef = doc.context.trailerInfo.Info;
  if (infoRef) doc.context.delete(infoRef as never);
  doc.context.trailerInfo.Info = undefined;
  return doc.save({ useObjectStreams: true });
}

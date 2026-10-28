import type { PdfFile } from '@/lib/pdf/types';

interface BaseItem {
  /** Identificador único en la lista (las páginas duplicadas tienen uno distinto). */
  uid: number;
  /** Rotación adicional en grados (0, 90, 180, 270). */
  rotation: number;
}

export interface SourcePageItem extends BaseItem {
  kind: 'page';
  file: PdfFile;
  /** Índice de la página en su archivo original. */
  index: number;
}

export interface BlankPageItem extends BaseItem {
  kind: 'blank';
  width: number;
  height: number;
}

export type PageItem = SourcePageItem | BlankPageItem;

/** Tamaño A4 en puntos. */
export const A4 = { width: 595.28, height: 841.89 };

import { createDocument, getLibDocument, savePdf } from '@/lib/pdf/document';
import { parseRanges } from '@/lib/pdf/ranges';
import type { PdfFile } from '@/lib/pdf/types';
import { baseName, padNumber } from '@/lib/utils/format';

export type SplitMode = 'cuts' | 'everyN' | 'single' | 'ranges';

export interface SplitSettings {
  mode: SplitMode;
  /** Cortar DESPUÉS de estas páginas (índices base 0). Modo "cuts". */
  cuts: Set<number>;
  /** Páginas por archivo. Modo "everyN". */
  everyN: number;
  /** Rangos escritos por el usuario. Modo "ranges". */
  rangesText: string;
}

/** Calcula los grupos de páginas (cada grupo será un archivo). */
export function computeGroups(pageCount: number, settings: SplitSettings): { groups: number[][]; error: string | null } {
  switch (settings.mode) {
    case 'single':
      return { groups: Array.from({ length: pageCount }, (_, i) => [i]), error: null };
    case 'everyN': {
      const size = Math.max(1, Math.floor(settings.everyN));
      const groups: number[][] = [];
      for (let start = 0; start < pageCount; start += size) {
        groups.push(Array.from({ length: Math.min(size, pageCount - start) }, (_, j) => start + j));
      }
      return { groups, error: null };
    }
    case 'ranges':
      return parseRanges(settings.rangesText, pageCount);
    case 'cuts': {
      const groups: number[][] = [[]];
      for (let i = 0; i < pageCount; i++) {
        groups[groups.length - 1].push(i);
        if (settings.cuts.has(i) && i < pageCount - 1) groups.push([]);
      }
      return { groups, error: null };
    }
  }
}

/** Convierte grupos consecutivos en posiciones de corte. */
export function cutsFromGroups(groups: number[][]): Set<number> {
  return new Set(groups.slice(0, -1).map((group) => group[group.length - 1]));
}

export interface SplitPart {
  name: string;
  bytes: Uint8Array;
}

export async function splitPdf(file: PdfFile, groups: number[][], onProgress?: (done: number, total: number) => void): Promise<SplitPart[]> {
  const source = await getLibDocument(file);
  const base = baseName(file.name);
  const parts: SplitPart[] = [];
  for (const [k, group] of groups.entries()) {
    onProgress?.(k, groups.length);
    const doc = await createDocument();
    const pages = await doc.copyPages(source, group);
    pages.forEach((page) => doc.addPage(page));
    const label = group.length === 1 ? `pag${group[0] + 1}` : `pags${group[0] + 1}-${group[group.length - 1] + 1}`;
    parts.push({ name: `${base}_parte${padNumber(k + 1, groups.length)}_${label}.pdf`, bytes: await savePdf(doc) });
  }
  return parts;
}

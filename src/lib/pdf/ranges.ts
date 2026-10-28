export interface ParsedRanges {
  /** Cada grupo es una lista de índices de página (base 0). */
  groups: number[][];
  error: string | null;
}

/** Interpreta "1-3, 5, 8-" → [[0,1,2],[4],[7,…,total-1]]. */
export function parseRanges(text: string, total: number): ParsedRanges {
  const groups: number[][] = [];
  const parts = text.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const range = part.match(/^(\d*)\s*-\s*(\d*)$/);
    let from: number, to: number;
    if (range) {
      from = range[1] ? Number(range[1]) : 1;
      to = range[2] ? Number(range[2]) : total;
    } else if (/^\d+$/.test(part)) {
      from = to = Number(part);
    } else {
      return { groups: [], error: `No entiendo "${part}"` };
    }
    if (from < 1 || to < 1 || from > total || to > total) {
      return { groups: [], error: `"${part}" está fuera de 1–${total}` };
    }
    const step = from <= to ? 1 : -1;
    const group: number[] = [];
    for (let page = from; page !== to + step; page += step) group.push(page - 1);
    groups.push(group);
  }
  return { groups, error: null };
}

/** [0,1,2,4] → "1-3, 5" */
export function rangesToText(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b).map((i) => i + 1);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return parts.join(', ');
}

/** Lista 0..n-1 */
export function allPages(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

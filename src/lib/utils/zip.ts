import JSZip from 'jszip';

export interface ZipEntry {
  name: string;
  data: Blob | Uint8Array;
}

/** Empaqueta varios archivos en un ZIP (en memoria). */
export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.data);
  return zip.generateAsync({ type: 'blob' });
}

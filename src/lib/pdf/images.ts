/* Preparación de imágenes para incrustarlas en un PDF. */
import type { PDFDocument, PDFImage } from 'pdf-lib';
import { canvasToBlob, readFileBytes } from '@/lib/utils/files';

export interface PreparedImage {
  bytes: Uint8Array;
  type: 'jpg' | 'png';
  width: number;
  height: number;
}

/** Orientación EXIF de un JPEG (1 si no tiene). */
function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) break;
    offset += 2 + length;
  }
  return 1;
}

async function imageSize(bytes: Uint8Array): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Prepara una imagen para pdf-lib (que solo admite JPG y PNG).
 * Otros formatos, o JPEG con rotación EXIF, se normalizan con un canvas.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bytes = await readFileBytes(file);
  const isJpg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
  const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
  if (isPng || (isJpg && jpegOrientation(bytes) === 1)) {
    return { bytes, type: isJpg ? 'jpg' : 'png', ...(await imageSize(bytes)) };
  }
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: file.type }), { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const type = isJpg ? 'jpg' : 'png';
  const blob = await canvasToBlob(canvas, type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
  return { bytes: await readFileBytes(blob), type, width: canvas.width, height: canvas.height };
}

/** Gira una imagen preparada (múltiplos de 90°). */
export async function rotateImage(image: PreparedImage, degreesClockwise: number): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(new Blob([image.bytes as BlobPart]));
  const swap = degreesClockwise % 180 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const context = canvas.getContext('2d')!;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degreesClockwise * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  const blob = await canvasToBlob(canvas, image.type === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
  return { bytes: await readFileBytes(blob), type: image.type, width: canvas.width, height: canvas.height };
}

export function embedImage(doc: PDFDocument, image: PreparedImage): Promise<PDFImage> {
  return image.type === 'jpg' ? doc.embedJpg(image.bytes) : doc.embedPng(image.bytes);
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(',')[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

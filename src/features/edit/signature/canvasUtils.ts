import type { SignatureImage } from '../types';

/** Recorta los bordes transparentes de un canvas y lo devuelve como PNG. */
export function trimCanvas(source: HTMLCanvasElement, margin = 6): SignatureImage | null {
  const context = source.getContext('2d')!;
  const { data, width, height } = context.getImageData(0, 0, source.width, source.height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return null;
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(width - 1, right + margin);
  bottom = Math.min(height - 1, bottom + margin);

  const output = document.createElement('canvas');
  output.width = right - left + 1;
  output.height = bottom - top + 1;
  output.getContext('2d')!.drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
  return { src: output.toDataURL('image/png'), width: output.width, height: output.height };
}

/** Escribe un texto con una fuente manuscrita y lo convierte en imagen. */
export function renderTypedSignature(text: string, fontFamily: string, color: string): SignatureImage | null {
  const size = 120;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = `${size}px ${fontFamily}`;
  canvas.width = Math.ceil(context.measureText(text).width) + 60;
  canvas.height = size * 1.8;
  // Cambiar el tamaño del canvas reinicia el contexto: se vuelve a configurar
  context.font = `${size}px ${fontFamily}`;
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.fillText(text, 30, canvas.height / 2);
  return trimCanvas(canvas);
}

/** Carga una imagen de firma y, opcionalmente, vuelve transparente el fondo claro. */
export async function processSignatureImage(file: File, removeBackground: boolean): Promise<SignatureImage | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1200 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  if (removeBackground) {
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = image;
    for (let i = 0; i < data.length; i += 4) {
      const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (luminance > 215) data[i + 3] = 0;
      else if (luminance > 170) data[i + 3] = Math.round((data[i + 3] * (215 - luminance)) / 45); // borde suave
    }
    context.putImageData(image, 0, 0);
  }
  return trimCanvas(canvas);
}

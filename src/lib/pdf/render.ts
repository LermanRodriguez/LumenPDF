/* Renderizado de páginas a canvas y miniaturas en caché. */
import type { PageViewport } from 'pdfjs-dist';
import { canvasToBlob } from '@/lib/utils/files';
import { getLibDocument } from './document';
import { getPdfJsDocument } from './pdfjs';
import type { PageSize, PdfFile } from './types';

export interface RenderOptions {
  /** Ancho deseado en píxeles (alternativa a scale). */
  width?: number;
  scale?: number;
  /** Rotación adicional a la propia de la página. */
  rotation?: number;
  /** 'print' no depende de requestAnimationFrame: úsalo para exportar. */
  intent?: 'display' | 'print';
  canvas?: HTMLCanvasElement;
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  viewport: PageViewport;
}

export async function renderPage(file: PdfFile, index: number, options: RenderOptions = {}): Promise<RenderResult> {
  const doc = await getPdfJsDocument(file);
  const page = await doc.getPage(index + 1);
  const rotation = (page.rotate + (options.rotation ?? 0)) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  const scale = options.scale ?? (options.width ?? base.width) / base.width;
  const viewport = page.getViewport({ scale, rotation });

  const canvas = options.canvas ?? document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport, intent: options.intent ?? 'display' }).promise;
  if (options.intent === 'print') page.cleanup();
  return { canvas, viewport };
}

/** Tamaño visual de una página (en puntos), considerando su rotación. */
export async function getPageSize(file: PdfFile, index: number): Promise<PageSize> {
  const page = (await getLibDocument(file)).getPage(index);
  const { width, height } = page.getSize();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return rotation % 180 ? { width: height, height: width, rotation } : { width, height, rotation };
}

/* ---------- Miniaturas ---------- */

// Cola con concurrencia limitada para no saturar el dispositivo
const MAX_CONCURRENT = 2;
const queue: Array<() => Promise<void>> = [];
let running = 0;

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.shift()!;
    running++;
    void job().finally(() => {
      running--;
      pump();
    });
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => task().then(resolve, reject));
    pump();
  });
}

const thumbnails = new Map<string, Promise<string>>();

/** URL (blob:) de la miniatura de una página. El ancho fijo permite reutilizar la caché. */
export function getThumbnailUrl(file: PdfFile, index: number, width = 240): Promise<string> {
  const key = `${file.id}:${index}:${width}`;
  let url = thumbnails.get(key);
  if (!url) {
    url = enqueue(async () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const { canvas } = await renderPage(file, index, { width: width * pixelRatio });
      return URL.createObjectURL(await canvasToBlob(canvas));
    });
    url.catch(() => thumbnails.delete(key));
    thumbnails.set(key, url);
  }
  return url;
}

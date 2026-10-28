import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getPageSize, renderPage } from '@/lib/pdf/render';
import type { PdfFile } from '@/lib/pdf/types';

export interface PreviewPageInfo {
  pageIndex: number;
  /** Tamaño de la página en puntos. */
  width: number;
  height: number;
}

/**
 * Dibuja encima de la vista previa. El contexto ya está escalado:
 * 1 unidad = 1 punto, con origen arriba a la izquierda.
 */
export type PreviewOverlay = (context: CanvasRenderingContext2D, page: PreviewPageInfo) => void;

interface PagePreviewProps {
  file: PdfFile;
  maxWidth?: number;
  maxHeight?: number;
  /** Cambia la identidad de la función (useCallback) para redibujar la capa. */
  drawOverlay?: PreviewOverlay;
}

interface RenderedPage extends PreviewPageInfo {
  cssWidth: number;
  cssHeight: number;
}

/** Vista previa grande de una página con navegación y una capa de dibujo encima. */
export function PagePreview({ file, maxWidth = 540, maxHeight = 640, drawOverlay }: PagePreviewProps) {
  // La página elegida se recuerda junto al archivo: al cambiar de archivo vuelve a la primera
  const [selection, setSelection] = useState({ fileId: file.id, pageIndex: 0 });
  const pageIndex = selection.fileId === file.id ? selection.pageIndex : 0;
  const setPageIndex = (index: number) => setSelection({ fileId: file.id, pageIndex: index });
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const overlayCanvas = useRef<HTMLCanvasElement>(null);

  // Renderiza la página
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = Math.min(maxWidth, (containerRef.current?.clientWidth ?? maxWidth) - 8);
      const size = await getPageSize(file, pageIndex);
      const scale = Math.min(available / size.width, maxHeight / size.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const { canvas } = await renderPage(file, pageIndex, { scale: scale * pixelRatio });
      const target = pageCanvas.current;
      if (cancelled || !target) return;
      target.width = canvas.width;
      target.height = canvas.height;
      target.getContext('2d')!.drawImage(canvas, 0, 0);
      setRendered({ pageIndex, width: size.width, height: size.height, cssWidth: size.width * scale, cssHeight: size.height * scale });
    })().catch((error: unknown) => console.error(error));
    return () => { cancelled = true; };
  }, [file, pageIndex, maxWidth, maxHeight]);

  // Dibuja la capa superior
  useEffect(() => {
    const canvas = overlayCanvas.current;
    if (!canvas || !rendered) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rendered.cssWidth * pixelRatio;
    canvas.height = rendered.cssHeight * pixelRatio;
    const context = canvas.getContext('2d')!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!drawOverlay) return;
    const scale = (rendered.cssWidth / rendered.width) * pixelRatio;
    context.save();
    context.scale(scale, scale);
    drawOverlay(context, rendered);
    context.restore();
  }, [drawOverlay, rendered]);

  const size = rendered ? { width: rendered.cssWidth, height: rendered.cssHeight } : undefined;
  return (
    <div ref={containerRef}>
      <div className="preview-stage">
        <div className="preview-page" style={size}>
          <canvas ref={pageCanvas} style={size} />
          <canvas ref={overlayCanvas} className="preview-overlay" />
        </div>
      </div>
      <div className="preview-nav">
        <Button size="sm" iconOnly icon="chevronLeft" aria-label="Página anterior" disabled={pageIndex === 0} onClick={() => setPageIndex(pageIndex - 1)} />
        <span>Página {pageIndex + 1} de {file.pageCount}</span>
        <Button size="sm" iconOnly icon="chevronRight" aria-label="Página siguiente" disabled={pageIndex >= file.pageCount - 1} onClick={() => setPageIndex(pageIndex + 1)} />
      </div>
    </div>
  );
}

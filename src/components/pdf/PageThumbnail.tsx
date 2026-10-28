import { useState } from 'react';
import { useFitScale } from '@/hooks/useFitScale';
import { useThumbnail } from '@/hooks/useThumbnail';
import type { PdfFile } from '@/lib/pdf/types';

interface PageThumbnailProps {
  file: PdfFile;
  pageIndex: number;
  /** Ancho de render en px (miniaturas del mismo ancho comparten caché). */
  width?: number;
  /** Rotación visual adicional en grados (múltiplo de 90). */
  rotation?: number;
}

/** Miniatura de una página que se renderiza al entrar en pantalla. */
export function PageThumbnail({ file, pageIndex, width = 240, rotation = 0 }: PageThumbnailProps) {
  const { ref, url } = useThumbnail<HTMLImageElement>(file, pageIndex, width);
  const [loaded, setLoaded] = useState(false);
  const scale = useFitScale(ref, rotation, loaded);

  return (
    <img
      ref={ref}
      className={loaded ? 'thumb' : 'thumb placeholder'}
      src={url ?? undefined}
      alt=""
      aria-label={`Página ${pageIndex + 1}`}
      draggable={false}
      onLoad={() => setLoaded(true)}
      style={rotation ? { transform: `rotate(${rotation}deg) scale(${scale})` } : undefined}
    />
  );
}


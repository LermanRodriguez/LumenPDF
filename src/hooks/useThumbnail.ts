import { useEffect, useRef, useState } from 'react';
import { getThumbnailUrl } from '@/lib/pdf/render';
import type { PdfFile } from '@/lib/pdf/types';

/**
 * URL de la miniatura de una página. Solo se genera cuando el elemento
 * está cerca de la pantalla, para no renderizar cientos de páginas a la vez.
 */
export function useThumbnail<T extends Element>(file: PdfFile, pageIndex: number, width: number) {
  const ref = useRef<T>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let cancelled = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      getThumbnailUrl(file, pageIndex, width)
        .then((result) => { if (!cancelled) setUrl(result); })
        .catch((error: unknown) => console.error(error));
    }, { rootMargin: '400px' });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [file, pageIndex, width]);

  return { ref, url };
}

import { useEffect, useEffectEvent } from 'react';
import { takeHandoff } from '@/lib/handoff';

/**
 * Recibe los archivos enviados desde otra herramienta ("Continuar con este PDF")
 * al abrir la pantalla.
 */
export function useHandoff(onFiles: (files: File[]) => void): void {
  const receive = useEffectEvent(onFiles);

  useEffect(() => {
    const files = takeHandoff();
    if (files?.length) receive(files);
  }, []);
}

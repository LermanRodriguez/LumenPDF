import { useEffect, useEffectEvent, useState } from 'react';
import { hasFiles, isDropHandled } from './dropEvents';

interface WindowDropProps {
  /** Texto que se muestra mientras se arrastra. */
  label: string;
  /** Solo actúa cuando hay trabajo abierto (si no, la zona central se encarga). */
  active: boolean;
  onFiles: (files: File[]) => void;
}

/** Permite soltar archivos en cualquier parte de la ventana. */
export function WindowDrop({ label, active, onFiles }: WindowDropProps) {
  const [visible, setVisible] = useState(false);

  // Funciones de evento: leen siempre los valores actuales sin re-suscribir los listeners
  const onEnter = useEffectEvent(() => { if (active) setVisible(true); });
  const onDropFiles = useEffectEvent((event: DragEvent) => {
    if (!active || isDropHandled(event)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  });

  useEffect(() => {
    let depth = 0;
    const hide = () => {
      depth = 0;
      setVisible(false);
    };
    const handleEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      onEnter();
    };
    const handleOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const handleLeave = () => { if (--depth <= 0) hide(); };
    const handleDrop = (e: DragEvent) => {
      hide(); // siempre se oculta, pase lo que pase con el archivo
      if (hasFiles(e)) onDropFiles(e);
    };
    window.addEventListener('dragenter', handleEnter);
    window.addEventListener('dragover', handleOver);
    window.addEventListener('dragleave', handleLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragend', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('dragenter', handleEnter);
      window.removeEventListener('dragover', handleOver);
      window.removeEventListener('dragleave', handleLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragend', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  return visible ? <div className="page-drop-overlay">{label}</div> : null;
}

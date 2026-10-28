import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { renderPage } from '@/lib/pdf/render';
import type { SourcePageItem } from '../types';

interface LargePageDialogProps {
  item: SourcePageItem;
  position: number;
  onClose: () => void;
}

/** Vista ampliada de una página. */
export function LargePageDialog({ item, position, onClose }: LargePageDialogProps) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    renderPage(item.file, item.index, { width: 1300, rotation: item.rotation })
      .then(({ canvas }) => {
        if (cancelled || !holder.current) return;
        canvas.className = 'large-page';
        holder.current.replaceChildren(canvas);
      })
      .catch((error: unknown) => console.error(error));
    return () => { cancelled = true; };
  }, [item]);

  return (
    <Modal
      wide
      title={`Página ${position}`}
      subtitle={`${item.file.name} · página original ${item.index + 1}`}
      onClose={onClose}
      actions={<Button variant="primary" onClick={onClose}>Cerrar</Button>}
    >
      <div ref={holder} className="large-page-wrap"><div className="spinner" /></div>
    </Modal>
  );
}

import { useRef, type MouseEvent } from 'react';
import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import { SortableItem } from '@/components/pdf/SortableGrid';
import { Icon } from '@/components/ui/Icon';
import { useFitScale } from '@/hooks/useFitScale';
import type { PageItem } from '../types';

interface PageCardProps {
  item: PageItem;
  position: number;
  selected: boolean;
  onClick: (event: MouseEvent) => void;
  onOpen: () => void;
  onRotate: (degrees: number) => void;
  onRemove: () => void;
}

/** Página arrastrable con acciones rápidas. */
export function PageCard({ item, position, selected, onClick, onOpen, onRotate, onRemove }: PageCardProps) {
  const stop = (action: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    action();
  };

  return (
    <SortableItem
      id={item.uid}
      className={`page-item${selected ? ' selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onOpen}
    >
      <div className="page-check" />
      <div className="page-actions">
        <button type="button" title="Girar a la izquierda" onClick={stop(() => onRotate(-90))}><Icon name="rotateCcw" /></button>
        <button type="button" title="Girar a la derecha" onClick={stop(() => onRotate(90))}><Icon name="rotateCw" /></button>
        <button type="button" title="Eliminar" onClick={stop(onRemove)}><Icon name="trash" /></button>
      </div>
      <div className="thumb-wrap">
        {item.kind === 'page'
          ? <PageThumbnail file={item.file} pageIndex={item.index} width={260} rotation={item.rotation} />
          : <BlankThumbnail width={item.width} height={item.height} rotation={item.rotation} />}
      </div>
      <div className="page-label">
        {item.kind === 'page' && <span className="src-dot" style={{ background: item.file.color }} title={item.file.name} />}
        <span>{position}</span>
        {item.kind === 'blank' && <span>· en blanco</span>}
      </div>
    </SortableItem>
  );
}

function BlankThumbnail({ width, height, rotation }: { width: number; height: number; rotation: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useFitScale(ref, rotation, true);
  const ratio = width / height;
  return (
    <div
      ref={ref}
      className="blank-page"
      style={{
        aspectRatio: String(ratio),
        ...(ratio < 1 ? { height: '100%' } : { width: '100%' }),
        transform: rotation ? `rotate(${rotation}deg) scale(${scale})` : undefined,
        transition: 'transform .25s ease',
      }}
    />
  );
}

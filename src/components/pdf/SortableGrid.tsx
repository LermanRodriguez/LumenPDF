import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

interface SortableGridProps<T> {
  items: T[];
  getId: (item: T) => string | number;
  /** Solo se llama si el orden cambió. */
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Elementos fijos al final (p. ej. "Añadir más"). */
  trailing?: ReactNode;
}

/** Rejilla cuyos elementos se reordenan arrastrando (ratón, táctil o teclado). */
export function SortableGrid<T>({ items, getId, onReorder, renderItem, className, style, trailing }: SortableGridProps<T>) {
  const sensors = useSensors(
    // Un pequeño umbral para que los clics no se confundan con arrastres
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, ids.indexOf(active.id), ids.indexOf(over.id)));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={className} style={style}>
          {items.map((item, index) => renderItem(item, index))}
          {trailing}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface SortableItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  id: string | number;
  children: ReactNode;
}

/** Elemento arrastrable dentro de <SortableGrid>. */
export function SortableItem({ id, className, style, children, ...rest }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? `${className ?? ''} is-dragging` : className}
      style={{ ...style, transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      {...rest}
    >
      {children}
    </div>
  );
}

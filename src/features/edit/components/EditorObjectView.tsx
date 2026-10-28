import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { EditorObject, ResizeHandle } from '../types';
import { LINE_HIT_PADDING, ObjectContent } from './ObjectContent';
import { TextBody } from './TextBody';

const HANDLES: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];

interface EditorObjectViewProps {
  object: EditorObject;
  zoom: number;
  /** Tamaño de la página en unidades de página (para no sacar objetos de ella). */
  pageWidth: number;
  pageHeight: number;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onFinishEditing: () => void;
  /** `record = false` mientras dura un arrastre. */
  onChange: (changes: Partial<EditorObject>, record?: boolean) => void;
  onInteractionStart: () => void;
  onInteractionEnd: (changed: boolean) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
}

/** Un objeto colocado sobre la página: se mueve arrastrándolo y se redimensiona por las esquinas. */
export function EditorObjectView(props: EditorObjectViewProps) {
  const { object, zoom, selected, editing } = props;
  const drag = useRef<{ handle: ResizeHandle | null; startX: number; startY: number; origin: EditorObject; moved: boolean } | null>(null);
  const padding = object.kind === 'line' ? LINE_HIT_PADDING : 0;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || editing) return;
    event.stopPropagation();
    event.preventDefault();
    props.onSelect();
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-handle]')?.dataset.handle as ResizeHandle | undefined;
    drag.current = { handle: handle ?? null, startX: event.clientX, startY: event.clientY, origin: object, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    props.onInteractionStart();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / zoom;
    const dy = (event.clientY - state.startY) / zoom;
    if (!state.moved && Math.abs(dx) + Math.abs(dy) < 0.5) return;
    state.moved = true;
    const changes = state.handle
      ? resize(state.origin, state.handle, dx, dy, event.shiftKey)
      : move(state.origin, dx, dy, props.pageWidth, props.pageHeight);
    props.onChange(changes, false);
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    props.onInteractionEnd(drag.current.moved);
    drag.current = null;
  };

  const style: CSSProperties = {
    left: object.x * zoom - padding,
    top: object.y * zoom - padding,
    opacity: object.opacity,
    ...(object.kind === 'text'
      ? {} // el texto se ajusta a su contenido
      : { width: object.w * zoom + padding * 2, height: object.h * zoom + padding * 2 }),
  };

  const classes = ['ed-obj', `kind-${object.kind}`, selected && 'sel', editing && 'editing'].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => { if (object.kind === 'text') props.onStartEditing(); }}
    >
      {object.kind === 'text' ? (
        <TextBody
          object={object}
          zoom={zoom}
          editing={editing}
          onTextChange={(text) => props.onChange({ text }, false)}
          onFinishEditing={props.onFinishEditing}
          onMeasure={(w, h) => props.onChange({ w, h }, false)}
        />
      ) : (
        <ObjectContent object={object} zoom={zoom} />
      )}

      {selected && !editing && (
        <>
          <div className="ed-obj-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" title="Traer al frente" onClick={props.onBringToFront}><Icon name="layers" /></button>
            <button type="button" title="Duplicar (Ctrl+D)" onClick={props.onDuplicate}><Icon name="copy" /></button>
            <button type="button" title="Eliminar (Supr)" onClick={props.onRemove}><Icon name="trash" /></button>
          </div>
          {HANDLES.map((handle) => <span key={handle} className={`ed-handle ${handle}`} data-handle={handle} />)}
        </>
      )}
    </div>
  );
}

/* ---------- Geometría de arrastre ---------- */

function move(origin: EditorObject, dx: number, dy: number, pageWidth: number, pageHeight: number): Partial<EditorObject> {
  // Se permite salir un poco del borde, pero siempre queda una parte visible
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    x: clamp(origin.x + dx, -origin.w + 10, pageWidth - 10),
    y: clamp(origin.y + dy, -origin.h + 10, pageHeight - 10),
  };
}

function resize(origin: EditorObject, handle: ResizeHandle, dx: number, dy: number, shiftKey: boolean): Partial<EditorObject> {
  let { x, y, w, h } = origin;
  if (handle.includes('e')) w = origin.w + dx;
  if (handle.includes('s')) h = origin.h + dy;
  if (handle.includes('w')) { w = origin.w - dx; x = origin.x + dx; }
  if (handle.includes('n')) { h = origin.h - dy; y = origin.y + dy; }

  // Imágenes y textos conservan la proporción (el resto, con Shift)
  const keepRatio = origin.kind === 'image' || origin.kind === 'text' || shiftKey;
  if (keepRatio && origin.w > 0 && origin.h > 0) {
    const factor = Math.max(w / origin.w, h / origin.h, 0.05);
    w = origin.w * factor;
    h = origin.h * factor;
    if (handle.includes('w')) x = origin.x + origin.w - w;
    if (handle.includes('n')) y = origin.y + origin.h - h;
  }
  const minSize = origin.kind === 'line' ? 0 : 4;
  const changes: Partial<EditorObject> = { x, y, w: Math.max(minSize, w), h: Math.max(minSize, h) };
  // En el texto, las esquinas cambian el tamaño de letra
  if (origin.kind === 'text') Object.assign(changes, { size: Math.max(4, Math.round(origin.size * (w / origin.w) * 10) / 10) });
  return changes;
}

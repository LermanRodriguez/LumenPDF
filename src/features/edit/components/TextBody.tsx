import { useEffectEvent, useLayoutEffect, useRef } from 'react';
import { FONTS, LINE_HEIGHT } from '../constants';
import type { TextObject } from '../types';

interface TextBodyProps {
  object: TextObject;
  zoom: number;
  editing: boolean;
  onTextChange: (text: string) => void;
  onFinishEditing: () => void;
  /** Informa del tamaño real del texto (en unidades de página). */
  onMeasure: (width: number, height: number) => void;
}

/** Texto de un objeto; editable en su sitio con doble clic. */
export function TextBody({ object, zoom, editing, onTextChange, onFinishEditing, onMeasure }: TextBodyProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Texto al empezar a editar: después el contenido del elemento lo controla el usuario
  const loadText = useEffectEvent(() => object.text);

  // Al empezar a editar: contenido inicial, foco y todo el texto seleccionado
  useLayoutEffect(() => {
    const element = ref.current;
    if (!editing || !element) return;
    element.textContent = loadText();
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editing]);

  // Mide el texto para que la caja de selección y los tiradores se ajusten
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const width = Math.max(element.scrollWidth, 8) / zoom;
    const height = Math.max(element.scrollHeight, object.size * LINE_HEIGHT * zoom) / zoom;
    if (Math.abs(width - object.w) > 0.5 || Math.abs(height - object.h) > 0.5) onMeasure(width, height);
  });

  const style = {
    fontFamily: FONTS[object.font].css,
    fontSize: object.size * zoom,
    color: object.color,
    fontWeight: object.bold ? 700 : 400,
    fontStyle: object.italic ? 'italic' : 'normal',
    minHeight: object.size * LINE_HEIGHT * zoom,
  } as const;

  if (editing) {
    // Elemento distinto (key) para que React no mezcle su contenido con lo que escribe el usuario
    return (
      <div
        key="editing"
        ref={ref}
        className="ed-text"
        style={style}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        onInput={(e) => onTextChange((e.currentTarget.innerText ?? '').replace(/\n$/, ''))}
        onBlur={onFinishEditing}
        onKeyDown={(e) => {
          e.stopPropagation(); // los atajos del editor no deben actuar mientras se escribe
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
      />
    );
  }

  return <div key="view" ref={ref} className="ed-text" style={style}>{object.text}</div>;
}

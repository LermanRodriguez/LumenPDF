import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Al girar 90°/270° una miniatura, calcula cuánto reducirla para que
 * siga cabiendo en su contenedor.
 */
export function useFitScale(ref: RefObject<HTMLElement | null>, rotation: number, ready: boolean): number {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = ref.current;
    const box = element?.parentElement;
    if (!element || !box || !ready || rotation % 180 === 0) {
      setScale(1);
      return;
    }
    // Se mide el DOM: es una sincronización con el layout, no estado derivado
    const width = element.offsetWidth || box.clientWidth;
    const height = element.offsetHeight || box.clientHeight;
    setScale(Math.min(1, box.clientWidth / height, box.clientHeight / width));
  }, [ref, rotation, ready]);

  return scale;
}

import { useCallback, useState } from 'react';
import { useUndoableState } from '@/hooks/useUndoableState';
import type { EditorObject } from './types';

let nextId = 0;

/** `Omit` aplicado a cada tipo de una unión (un Omit normal la aplanaría y perdería propiedades). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Objeto nuevo (el id se asigna al añadirlo). */
export type NewEditorObject = DistributiveOmit<EditorObject, 'id'>;

/** Objeto sin posición, para colocarlo automáticamente. */
export type UnplacedEditorObject = DistributiveOmit<EditorObject, 'id' | 'page' | 'x' | 'y'>;

/**
 * Estado de los objetos del editor: lista con historial para deshacer y selección.
 */
export function useEditorObjects() {
  const { state: objects, set, update, undo: undoHistory, reset: resetHistory, canUndo, checkpoint, dropCheckpoint } =
    useUndoableState<EditorObject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const add = useCallback((object: NewEditorObject): EditorObject => {
    const created = { ...object, id: nextId++ } as EditorObject;
    update((list) => [...list, created]);
    setSelectedId(created.id);
    return created;
  }, [update]);

  /** Cambia un objeto. Con `record = false` no guarda historial (p. ej. mientras se arrastra). */
  const patch = useCallback((id: number, changes: Partial<EditorObject>, record = true) => {
    (record ? update : set)((list) => list.map((o) => (o.id === id ? ({ ...o, ...changes } as EditorObject) : o)));
  }, [set, update]);

  const remove = useCallback((id: number, record = true) => {
    (record ? update : set)((list) => list.filter((o) => o.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, [set, update]);

  const duplicate = useCallback((id: number) => {
    const copyId = nextId++;
    update((list) => {
      const original = list.find((o) => o.id === id);
      return original ? [...list, { ...structuredClone(original), id: copyId, x: original.x + 12, y: original.y + 12 }] : list;
    });
    setSelectedId(copyId);
  }, [update]);

  const bringToFront = useCallback((id: number) => {
    update((list) => {
      const target = list.find((o) => o.id === id);
      return target ? [...list.filter((o) => o.id !== id), target] : list;
    });
  }, [update]);

  const undo = useCallback(() => {
    const done = undoHistory();
    if (done) setSelectedId(null);
    return done;
  }, [undoHistory]);

  const reset = useCallback(() => {
    resetHistory([]);
    setSelectedId(null);
  }, [resetHistory]);

  return {
    objects,
    selected: objects.find((o) => o.id === selectedId) ?? null,
    select: setSelectedId,
    add,
    patch,
    remove,
    duplicate,
    bringToFront,
    undo,
    reset,
    canUndo,
    /** Interacciones largas: guardar punto de historial al empezar y descartarlo si no cambió nada. */
    checkpoint,
    dropCheckpoint,
  };
}

export type EditorObjectsApi = ReturnType<typeof useEditorObjects>;

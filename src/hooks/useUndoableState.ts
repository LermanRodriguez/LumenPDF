import { useCallback, useState, type SetStateAction } from 'react';

const MAX_HISTORY = 80;

interface History<T> {
  present: T;
  past: T[];
}

const resolve = <T,>(value: SetStateAction<T>, current: T): T =>
  typeof value === 'function' ? (value as (previous: T) => T)(current) : value;

const pushPast = <T,>(past: T[], value: T): T[] => [...past.slice(-(MAX_HISTORY - 1)), value];

/**
 * Estado con historial para deshacer.
 * - `set` cambia el estado SIN guardar historial (útil mientras se arrastra algo).
 * - `checkpoint` guarda el estado actual como punto al que se puede volver.
 * - `update` = checkpoint + set, para cambios puntuales.
 */
export function useUndoableState<T>(initial: T) {
  const [history, setHistory] = useState<History<T>>({ present: initial, past: [] });
  const canUndo = history.past.length > 0;

  const set = useCallback((value: SetStateAction<T>) => {
    setHistory((h) => ({ ...h, present: resolve(value, h.present) }));
  }, []);

  const update = useCallback((value: SetStateAction<T>) => {
    setHistory((h) => ({ past: pushPast(h.past, h.present), present: resolve(value, h.present) }));
  }, []);

  const checkpoint = useCallback(() => {
    setHistory((h) => ({ ...h, past: pushPast(h.past, h.present) }));
  }, []);

  /** Descarta el último punto guardado (p. ej. si un arrastre no movió nada). */
  const dropCheckpoint = useCallback(() => {
    setHistory((h) => ({ ...h, past: h.past.slice(0, -1) }));
  }, []);

  /** Vuelve al último punto guardado. Devuelve false si no había nada que deshacer. */
  const undo = useCallback((): boolean => {
    if (!canUndo) return false;
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1] } : h));
    return true;
  }, [canUndo]);

  const reset = useCallback((value: T) => setHistory({ present: value, past: [] }), []);

  return { state: history.present, set, update, checkpoint, dropCheckpoint, undo, reset, canUndo };
}

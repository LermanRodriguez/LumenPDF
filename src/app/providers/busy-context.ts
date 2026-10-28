import { createContext, useContext } from 'react';

/** Permite a una tarea larga informar de su avance. */
export interface ProgressReporter {
  setText(text: string): void;
  setProgress(done: number, total: number): void;
}

/**
 * Ejecuta una tarea mostrando el indicador "Procesando…".
 * Si falla, muestra el error y devuelve undefined.
 */
export type RunTask = <T>(label: string, task: (progress: ProgressReporter) => Promise<T>) => Promise<T | undefined>;

export const BusyContext = createContext<RunTask | null>(null);

export function useBusyTask(): RunTask {
  const run = useContext(BusyContext);
  if (!run) throw new Error('useBusyTask debe usarse dentro de <BusyProvider>');
  return run;
}

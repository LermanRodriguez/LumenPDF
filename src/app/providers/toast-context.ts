import { createContext, useContext } from 'react';

export type ToastType = 'ok' | 'err' | 'warn' | 'info';

export type ShowToast = (message: string, type?: ToastType, durationMs?: number) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** Muestra avisos breves en la parte inferior de la pantalla. */
export function useToast(): ShowToast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return toast;
}

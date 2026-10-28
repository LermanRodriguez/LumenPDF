import { createContext, useContext, type ReactNode } from 'react';

/**
 * Abre un diálogo. `render` recibe `close(valor)` para cerrarlo y devolver un resultado.
 * La promesa se resuelve con ese valor, o con undefined si se cierra sin elegir.
 */
export type OpenDialog = <T>(render: (close: (value?: T) => void) => ReactNode) => Promise<T | undefined>;

export interface DialogApi {
  open: OpenDialog;
  confirm(title: string, message: ReactNode, confirmLabel?: string): Promise<boolean>;
  askPassword(fileName: string, wrongAttempt: boolean): Promise<string | undefined>;
}

export const DialogContext = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialogs debe usarse dentro de <DialogProvider>');
  return api;
}

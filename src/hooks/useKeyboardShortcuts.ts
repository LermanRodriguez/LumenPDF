import { useEffect, useEffectEvent } from 'react';

const TYPING_TARGETS = 'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]';

/**
 * Atajos de teclado de una pantalla. No se activan mientras se escribe
 * en un campo ni cuando hay un diálogo abierto.
 */
export function useKeyboardShortcuts(handler: (event: KeyboardEvent, ctrl: boolean) => void): void {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if ((event.target as HTMLElement).closest?.(TYPING_TARGETS)) return;
    if (document.querySelector('.modal-back')) return;
    handler(event, event.ctrlKey || event.metaKey);
  });

  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

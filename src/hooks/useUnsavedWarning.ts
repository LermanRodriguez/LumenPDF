import { useEffect } from 'react';

/** Avisa al cerrar o recargar la pestaña si hay trabajo sin guardar. */
export function useUnsavedWarning(hasUnsavedWork: boolean): void {
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);
}

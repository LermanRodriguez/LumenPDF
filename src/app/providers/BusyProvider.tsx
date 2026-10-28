import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '@/lib/utils/errors';
import { BusyContext, type ProgressReporter, type RunTask } from './busy-context';
import { useToast } from './toast-context';

interface BusyState {
  text: string;
  /** 0–1, o null si no hay progreso medible. */
  progress: number | null;
}

/** Deja que el navegador pinte el indicador antes de empezar a trabajar. */
const nextPaint = () => new Promise((resolve) => setTimeout(resolve, 30));

export function BusyProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [state, setState] = useState<BusyState | null>(null);
  const depth = useRef(0);

  const reporter = useMemo<ProgressReporter>(() => ({
    setText: (text) => setState((s) => (s ? { ...s, text } : s)),
    setProgress: (done, total) => setState((s) => (s ? { ...s, progress: done / Math.max(total, 1) } : s)),
  }), []);

  const runTask = useCallback<RunTask>(async (label, task) => {
    depth.current++;
    setState({ text: label, progress: null });
    await nextPaint();
    try {
      return await task(reporter);
    } catch (error) {
      console.error(error);
      toast(errorMessage(error), 'err', 6000);
      return undefined;
    } finally {
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setState(null);
    }
  }, [reporter, toast]);

  return (
    <BusyContext.Provider value={runTask}>
      {children}
      {state && (
        <div className="busy">
          <div className="busy-card" role="status">
            <div className="spinner" />
            <div className="busy-text">{state.text}</div>
            {state.progress !== null && (
              <div className="progress"><div className="progress-bar" style={{ width: `${Math.round(state.progress * 100)}%` }} /></div>
            )}
            <div className="busy-note">Procesando en tu dispositivo</div>
          </div>
        </div>
      )}
    </BusyContext.Provider>
  );
}

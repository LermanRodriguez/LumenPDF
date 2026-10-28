import { useCallback, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ToastContext, type ShowToast, type ToastType } from './toast-context';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  leaving: boolean;
}

const TOAST_ICONS: Record<ToastType, IconName> = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' };
const FADE_MS = 300;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback<ShowToast>((message, type = 'ok', durationMs = 3200) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, message, type, leaving: false }]);
    setTimeout(() => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), FADE_MS);
    }, durationMs);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}${toast.leaving ? ' leaving' : ''}`}>
            <Icon name={TOAST_ICONS[toast.type]} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

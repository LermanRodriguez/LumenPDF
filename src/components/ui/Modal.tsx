import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Ventana modal. Se cierra con Escape o haciendo clic fuera. */
export function Modal({ title, subtitle, wide, onClose, actions, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? 'modal wide' : 'modal'} role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {subtitle && <p className="modal-sub">{subtitle}</p>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

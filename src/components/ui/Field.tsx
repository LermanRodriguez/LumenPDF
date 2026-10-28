import { useId, type ReactNode } from 'react';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: boolean;
  /** Recibe el id para enlazar la etiqueta con el control. */
  children: ReactNode | ((id: string) => ReactNode);
}

/** Campo de formulario con etiqueta y texto de ayuda. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      {label && <label className="field-label" htmlFor={id}>{label}</label>}
      {typeof children === 'function' ? children(id) : children}
      {hint && <span className={error ? 'hint hint-error' : 'hint'}>{hint}</span>}
    </div>
  );
}

interface SideBlockProps {
  title?: ReactNode;
  children: ReactNode;
}

/** Bloque del panel lateral con título opcional. */
export function SideBlock({ title, children }: SideBlockProps) {
  return (
    <div className="side-block">
      {title && <div className="side-title">{title}</div>}
      {children}
    </div>
  );
}

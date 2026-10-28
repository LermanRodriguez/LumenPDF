import { Link } from 'react-router';

/** Logotipo + nombre de la plataforma. */
export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="LumenPDF, inicio">
      <span className="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="currentColor" />
          <path d="M10 7h9l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" fill="#fff" />
          <path d="M19 7v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
      <span className="brand-name">Lumen<span className="brand-accent">PDF</span></span>
    </Link>
  );
}

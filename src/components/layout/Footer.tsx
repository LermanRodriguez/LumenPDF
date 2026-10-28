import { Link } from 'react-router';
import { getTool, type ToolId } from '@/features/catalog';
import { Brand } from './Brand';

const FEATURED_TOOLS: ToolId[] = ['unir', 'dividir', 'editar', 'comprimir', 'proteger'];

const CURRENT_YEAR = new Date().getFullYear();

const PRIVACY_POINTS = [
  'Procesamiento 100% local',
  'Funciona sin conexión',
  'Cifrado AES-256',
  'Sin publicidad ni seguimiento',
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Brand />
          <p>
            Herramientas profesionales para trabajar con PDF, diseñadas con un principio claro: tus documentos son tuyos.
            Todo se procesa en tu dispositivo, sin servidores, sin cuentas y sin rastreo.
          </p>
        </div>
        <nav className="footer-col" aria-label="Herramientas">
          <h4>Herramientas</h4>
          {FEATURED_TOOLS.map((id) => <Link key={id} to={`/${id}`}>{getTool(id).name}</Link>)}
        </nav>
        <div className="footer-col">
          <h4>Compromiso de privacidad</h4>
          {PRIVACY_POINTS.map((point) => <span key={point}>{point}</span>)}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {CURRENT_YEAR} LumenPDF. Todos los derechos reservados.</span>
        <span className="footer-credit">Diseñado y desarrollado por <strong>Lerman Maestre</strong></span>
      </div>
    </footer>
  );
}

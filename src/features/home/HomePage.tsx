import { useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SECTIONS, TOOLS } from '@/features/catalog';

const HIGHLIGHTS: { icon: IconName; text: string }[] = [
  { icon: 'shield', text: 'Privado: sin servidores' },
  { icon: 'wifiOff', text: 'Funciona sin internet' },
  { icon: 'zap', text: 'Sin límites de tamaño ni de archivos' },
];

export function HomePage() {
  useEffect(() => { document.title = 'LumenPDF'; }, []);

  return (
    <div className="home">
      <div className="hero">
        <h1>Todas tus herramientas PDF, sin subir nada</h1>
        <p>Une, divide, edita, firma, comprime y protege tus PDFs. Todo el procesamiento ocurre aquí, en tu dispositivo.</p>
        <div className="hero-pills">
          {HIGHLIGHTS.map((h) => <span key={h.text} className="pill"><Icon name={h.icon} />{h.text}</span>)}
        </div>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.id}>
          <h2 className="tool-section-title">{section.title}</h2>
          <div className="tool-grid">
            {TOOLS.filter((tool) => tool.section === section.id).map((tool) => (
              <Link key={tool.id} className="tool-card" to={`/${tool.id}`} style={{ '--c': tool.color } as CSSProperties}>
                <div className="tool-icon"><Icon name={tool.icon} /></div>
                <h3>{tool.name}</h3>
                <p>{tool.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

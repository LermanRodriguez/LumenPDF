import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import type { ToolInfo } from '@/features/catalog';

interface ToolLayoutProps {
  tool: ToolInfo;
  /** Contenido del panel lateral. Si se omite, no hay panel. */
  sidebar?: ReactNode;
  /** Botones fijos al pie del panel lateral. */
  sidebarFooter?: ReactNode;
  /** Sin márgenes en el área principal (editor). */
  flush?: boolean;
  children: ReactNode;
}

/** Estructura común: cabecera de la herramienta, área principal y panel lateral. */
export function ToolLayout({ tool, sidebar, sidebarFooter, flush, children }: ToolLayoutProps) {
  useEffect(() => {
    document.title = `${tool.name} · LumenPDF`;
    return () => { document.title = 'LumenPDF'; };
  }, [tool.name]);

  const hasSidebar = sidebar !== undefined;
  return (
    <section className={hasSidebar ? 'tool-view' : 'tool-view no-side'} style={{ '--c': tool.color } as CSSProperties}>
      <div className="tool-main">
        <div className="tool-header">
          <Link className="back-btn" to="/"><Icon name="arrowLeft" />Inicio</Link>
          <div className="tool-icon"><Icon name={tool.icon} /></div>
          <div>
            <h2>{tool.name}</h2>
            <p>{tool.description}</p>
          </div>
        </div>
        <div className={flush ? 'tool-body flush' : 'tool-body'}>{children}</div>
      </div>
      {hasSidebar && (
        <aside className="tool-side">
          <div className="side-scroll">{sidebar}</div>
          <div className="side-footer">{sidebarFooter}</div>
        </aside>
      )}
    </section>
  );
}

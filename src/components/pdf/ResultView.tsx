import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FOLLOW_UP_TOOLS, getTool, type ToolId } from '@/features/catalog';
import { setHandoff } from '@/lib/handoff';
import { resultSize, type ResultFile } from '@/lib/pdf/types';
import { downloadFile } from '@/lib/utils/files';
import { formatBytes } from '@/lib/utils/format';

interface ResultViewProps {
  /** Herramienta actual (se excluye de "Continuar con…"). */
  toolId: ToolId;
  result: ResultFile;
  title: string;
  subtitle?: ReactNode;
  icon?: IconName;
  /** Contenido extra (comparaciones, listas…). */
  children?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}

/** Pantalla final: descarga automática, botón para descargar de nuevo y continuar con otra herramienta. */
export function ResultView({ toolId, result, title, subtitle, icon = 'check', children, onBack, backLabel = 'Volver a editar' }: ResultViewProps) {
  const navigate = useNavigate();
  const download = () => downloadFile(result.type === 'pdf' ? result.bytes : result.blob, result.name);

  // Descarga automática una sola vez por resultado
  const downloaded = useRef<ResultFile | null>(null);
  useEffect(() => {
    if (downloaded.current === result) return;
    downloaded.current = result;
    downloadFile(result.type === 'pdf' ? result.bytes : result.blob, result.name);
  }, [result]);

  const continueWith = (id: ToolId) => {
    if (result.type !== 'pdf') return;
    setHandoff([new File([result.bytes as BlobPart], result.name, { type: 'application/pdf' })]);
    navigate(`/${id}`);
  };

  return (
    <div className="result-card">
      <div className="rc-icon"><Icon name={icon} /></div>
      <h3>{title}</h3>
      <p className="rc-sub">{subtitle ?? <><b>{result.name}</b> · {formatBytes(resultSize(result))}</>}</p>
      {children}
      <div className="result-actions">
        <Button variant="primary" size="lg" icon="download" onClick={download}>Descargar</Button>
        {onBack && <Button size="lg" icon="arrowLeft" onClick={onBack}>{backLabel}</Button>}
      </div>
      {result.type === 'pdf' && (
        <div className="result-next">
          <div className="side-title">Continuar con este PDF</div>
          <div className="result-actions">
            {FOLLOW_UP_TOOLS.filter((id) => id !== toolId).map((id) => {
              const tool = getTool(id);
              return (
                <Button key={id} size="sm" icon={tool.icon} style={{ '--c': tool.color } as CSSProperties} onClick={() => continueWith(id)}>
                  {tool.name}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface NoticeViewProps {
  title: string;
  subtitle: ReactNode;
  icon?: IconName;
  actions: ReactNode;
}

/** Tarjeta informativa sin descarga (p. ej. "este PDF no tiene contraseña"). */
export function NoticeView({ title, subtitle, icon = 'info', actions }: NoticeViewProps) {
  return (
    <div className="result-card">
      <div className="rc-icon neutral"><Icon name={icon} /></div>
      <h3>{title}</h3>
      <p className="rc-sub">{subtitle}</p>
      <div className="result-actions">{actions}</div>
    </div>
  );
}

import { useState, type CSSProperties, type DragEvent, type KeyboardEvent } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PDF_ACCEPT, pickFiles } from '@/lib/utils/files';
import { markDropHandled } from './dropEvents';

interface DropzoneProps {
  title: string;
  subtitle?: string;
  accept?: string;
  multiple?: boolean;
  icon?: IconName;
  color?: string;
  buttonLabel?: string;
  onFiles: (files: File[]) => void;
}

/** Zona grande para arrastrar o elegir archivos. */
export function Dropzone({
  title,
  subtitle = 'o haz clic para elegirlos',
  accept = PDF_ACCEPT,
  multiple = true,
  icon = 'upload',
  color,
  buttonLabel = 'Elegir archivos',
  onFiles,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false);

  const pick = async () => {
    const files = await pickFiles({ accept, multiple });
    if (files.length) onFiles(files);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    markDropHandled(event.nativeEvent);
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void pick();
    }
  };

  return (
    <div
      className={dragging ? 'dropzone drag' : 'dropzone'}
      style={color ? ({ '--c': color } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      onClick={() => void pick()}
      onKeyDown={onKeyDown}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="dz-icon"><Icon name={icon} /></div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
      <span className="btn btn-primary btn-lg"><Icon name="upload" />{buttonLabel}</span>
      <div className="dz-note"><Icon name="shield" />Tus archivos se procesan en este dispositivo y nunca se suben a internet.</div>
    </div>
  );
}

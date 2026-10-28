import { Button } from '@/components/ui/Button';
import type { PdfFile } from '@/lib/pdf/types';
import { pickFiles } from '@/lib/utils/files';
import { formatBytes, plural } from '@/lib/utils/format';
import { PageThumbnail } from './PageThumbnail';

interface DocSummaryProps {
  file: PdfFile;
  /** Si se indica, muestra el botón "Cambiar" para elegir otro PDF. */
  onChangeFile?: (files: File[]) => void;
}

/** Tarjeta con miniatura, nombre y datos del documento abierto. */
export function DocSummary({ file, onChangeFile }: DocSummaryProps) {
  const change = async () => {
    const files = await pickFiles({ multiple: false });
    if (files.length) onChangeFile?.(files);
  };

  return (
    <div className="doc-summary">
      <div className="ds-thumb"><PageThumbnail file={file} pageIndex={0} width={120} /></div>
      <div className="ds-grow">
        <div className="ds-name">{file.name}</div>
        <div className="ds-meta">
          {plural(file.pageCount, 'página', 'páginas')} · {formatBytes(file.bytes.length)}
          {file.wasEncrypted && ' · descifrado'}
        </div>
      </div>
      {onChangeFile && <Button size="sm" icon="file" onClick={() => void change()}>Cambiar</Button>}
    </div>
  );
}

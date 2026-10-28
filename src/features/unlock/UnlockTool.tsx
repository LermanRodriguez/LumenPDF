import { useState } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { useDialogs } from '@/app/providers/dialog-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Dropzone } from '@/components/pdf/Dropzone';
import { NoticeView, ResultView } from '@/components/pdf/ResultView';
import { Button } from '@/components/ui/Button';
import { InfoBox } from '@/components/ui/controls';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { loadPdf } from '@/lib/pdf/loader';
import type { PdfFile } from '@/lib/pdf/types';
import { baseName, formatBytes } from '@/lib/utils/format';

const tool = getTool('desbloquear');

/** Al abrir un PDF protegido ya se descifra (ver loader.ts): solo hay que guardarlo. */
export default function UnlockTool() {
  const runTask = useBusyTask();
  const { askPassword } = useDialogs();
  const [opened, setOpened] = useState<{ pdf: PdfFile; originalName: string } | null>(null);

  const load = async ([file]: File[]) => {
    if (!file) return;
    const pdf = await runTask('Abriendo PDF…', () => loadPdf(file, askPassword));
    if (pdf) setOpened({ pdf, originalName: file.name });
  };
  useHandoff(load);

  if (!opened) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone
          title="Suelta el PDF protegido"
          subtitle="Te pediremos la contraseña si la necesita"
          multiple={false}
          icon="unlock"
          color={tool.color}
          buttonLabel="Elegir PDF"
          onFiles={load}
        />
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <InfoBox>
            Solo funciona si conoces la contraseña. Los PDF que únicamente tienen restricciones (no dejan imprimir o copiar) se desbloquean sin contraseña.
          </InfoBox>
        </div>
      </ToolLayout>
    );
  }

  const { pdf, originalName } = opened;

  if (!pdf.wasEncrypted) {
    return (
      <ToolLayout tool={tool}>
        <NoticeView
          title="Este PDF no tiene contraseña"
          subtitle={<><b>{originalName}</b> ya se puede abrir libremente. No hace falta desbloquearlo.</>}
          actions={<Button variant="primary" size="lg" icon="file" onClick={() => setOpened(null)}>Elegir otro PDF</Button>}
        />
      </ToolLayout>
    );
  }

  return (
    <ToolLayout tool={tool}>
      <ResultView
        toolId={tool.id}
        result={{ type: 'pdf', name: `${baseName(originalName)}_desbloqueado.pdf`, bytes: pdf.bytes }}
        icon="unlock"
        title="¡Contraseña eliminada!"
        subtitle={pdf.password
          ? `Se quitó la contraseña de apertura y todas las restricciones · ${formatBytes(pdf.bytes.length)}`
          : `Este PDF tenía restricciones (imprimir, copiar…). Se han eliminado · ${formatBytes(pdf.bytes.length)}`}
        onBack={() => setOpened(null)}
        backLabel="Desbloquear otro"
      />
    </ToolLayout>
  );
}

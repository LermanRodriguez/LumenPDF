import { useState, type CSSProperties } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { Checkbox, InfoBox, PasswordInput, StatRow } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { encryptPdf, type PdfPermissions } from '@/lib/pdf/qpdf';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { baseName, formatBytes } from '@/lib/utils/format';
import { passwordStrength, randomPassword } from './passwordStrength';

const tool = getTool('proteger');

const PERMISSION_LABELS: Record<keyof PdfPermissions, string> = {
  print: 'Imprimir',
  copy: 'Copiar texto e imágenes',
  modify: 'Modificar el documento',
  annotate: 'Añadir comentarios',
  forms: 'Rellenar formularios',
};

export default function ProtectTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [permissions, setPermissions] = useState<PdfPermissions>({ print: true, copy: false, modify: false, annotate: true, forms: true });
  const [result, setResult] = useState<ResultFile | null>(null);

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (pdf) {
      setFile(pdf);
      setResult(null);
    }
  };
  useHandoff(load);

  const matches = password.length > 0 && password === confirmation;
  const strength = passwordStrength(password);

  const protect = () => runTask('Cifrando con AES-256…', async () => {
    if (!file || !matches) return;
    // Contraseña de propietario aleatoria: así los permisos se aplican de verdad
    const bytes = await encryptPdf(file.bytes, password, randomPassword(), permissions);
    setResult({ type: 'pdf', name: `${baseName(file.name)}_protegido.pdf`, bytes });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result}
          icon="lock"
          title="¡PDF protegido!"
          subtitle={`Ahora se necesita la contraseña para abrirlo · ${formatBytes(resultSize(result))}`}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres proteger" multiple={false} icon="lock" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const sidebar = (
    <>
      <SideBlock title="Permisos (sin la contraseña de propietario)">
        {(Object.keys(PERMISSION_LABELS) as (keyof PdfPermissions)[]).map((key) => (
          <Checkbox key={key} checked={permissions[key]} onChange={(value) => setPermissions((p) => ({ ...p, [key]: value }))}>
            {PERMISSION_LABELS[key]}
          </Checkbox>
        ))}
        <p className="hint" style={{ marginTop: 8 }}>Los lectores de PDF respetan estos permisos, aunque no todos los programas lo hacen.</p>
      </SideBlock>
      <SideBlock>
        <StatRow label="Cifrado" value="AES-256" />
      </SideBlock>
    </>
  );

  const matchHint = !confirmation ? undefined : matches ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden';

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={<Button variant="primary" size="lg" icon="lock" disabled={!matches} onClick={() => void protect()}>Proteger PDF</Button>}
    >
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <div className="center-col" style={{ '--c': tool.color } as CSSProperties}>
        <div className="lock-visual"><Icon name="lock" /></div>
        <Field label="Contraseña para abrir el PDF">
          {(id) => (
            <>
              <PasswordInput id={id} value={password} onChange={setPassword} placeholder="Escribe una contraseña" autoFocus />
              <div className="strength"><div style={{ width: `${strength.percent}%`, background: strength.color }} /></div>
              <span className="strength-label">{strength.label}</span>
            </>
          )}
        </Field>
        <Field label="Repite la contraseña" hint={matchHint} error={!!confirmation && !matches}>
          {(id) => <PasswordInput id={id} value={confirmation} onChange={setConfirmation} onEnter={() => { if (matches) void protect(); }} />}
        </Field>
        <InfoBox warn>
          Guarda bien la contraseña: <b>no hay forma de recuperarla</b> si la olvidas. El cifrado ocurre en tu dispositivo.
        </InfoBox>
      </div>
    </ToolLayout>
  );
}

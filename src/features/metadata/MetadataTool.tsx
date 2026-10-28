import { useState } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { InfoBox, StatRow } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import type { PdfFile, ResultFile } from '@/lib/pdf/types';
import { baseName, formatBytes } from '@/lib/utils/format';
import { readMetadata, removeMetadata, writeMetadata, type DocumentInfo, type EditableMetadata } from './metadata';

const tool = getTool('metadatos');

const FIELDS: { key: keyof EditableMetadata; label: string; multiline?: boolean }[] = [
  { key: 'title', label: 'Título' },
  { key: 'author', label: 'Autor' },
  { key: 'subject', label: 'Asunto', multiline: true },
  { key: 'keywords', label: 'Palabras clave', multiline: true },
  { key: 'creator', label: 'Aplicación de origen' },
  { key: 'producer', label: 'Productor PDF' },
];

interface Loaded {
  file: PdfFile;
  metadata: EditableMetadata;
  info: DocumentInfo;
}

export default function MetadataTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [result, setResult] = useState<{ file: ResultFile; wiped: boolean } | null>(null);

  const load = async (files: File[]) => {
    const file = await loadOne(files);
    if (!file) return;
    const data = await runTask('Leyendo propiedades…', () => readMetadata(file));
    if (data) {
      setLoaded({ file, ...data });
      setResult(null);
    }
  };
  useHandoff(load);

  const setField = (key: keyof EditableMetadata, value: string) =>
    setLoaded((current) => (current ? { ...current, metadata: { ...current.metadata, [key]: value } } : current));

  const save = (wipe: boolean) => runTask('Guardando…', async () => {
    if (!loaded) return;
    const bytes = wipe ? await removeMetadata(loaded.file) : await writeMetadata(loaded.file, loaded.metadata);
    const suffix = wipe ? '_sin_metadatos' : '_propiedades';
    setResult({ file: { type: 'pdf', name: `${baseName(loaded.file.name)}${suffix}.pdf`, bytes }, wiped: wipe });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title={result.wiped ? '¡Metadatos eliminados!' : '¡Propiedades guardadas!'}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!loaded) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta un PDF para ver sus propiedades" multiple={false} icon="tag" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const { file, metadata, info } = loaded;

  const sidebar = (
    <>
      <SideBlock title="Información">
        <StatRow label="Versión PDF" value={info.version} />
        <StatRow label="Páginas" value={file.pageCount} />
        <StatRow label="Tamaño de página" value={info.pageSize} />
        <StatRow label="Tamaño de archivo" value={formatBytes(file.bytes.length)} />
        <StatRow label="Creado" value={info.created} />
        <StatRow label="Modificado" value={info.modified} />
        <StatRow label="Metadatos XMP" value={info.hasXmp ? 'Sí' : 'No'} />
      </SideBlock>
      <SideBlock>
        <InfoBox>Los metadatos pueden revelar tu nombre, el programa que usaste o fechas. Bórralos antes de compartir si quieres más privacidad.</InfoBox>
      </SideBlock>
    </>
  );

  const footer = (
    <>
      <Button icon="trash" onClick={() => void save(true)}>Borrar todos los metadatos</Button>
      <Button variant="primary" size="lg" icon="download" onClick={() => void save(false)}>Guardar cambios</Button>
    </>
  );

  return (
    <ToolLayout tool={tool} sidebar={sidebar} sidebarFooter={footer}>
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <div className="center-col" style={{ maxWidth: 640 }}>
        {FIELDS.map(({ key, label, multiline }) => (
          <Field key={key} label={label}>
            {(id) => multiline
              ? <textarea id={id} className="input" rows={2} value={metadata[key]} onChange={(e) => setField(key, e.target.value)} />
              : <input id={id} className="input" value={metadata[key]} onChange={(e) => setField(key, e.target.value)} />}
          </Field>
        ))}
      </div>
    </ToolLayout>
  );
}

import { useState } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import { ResultView } from '@/components/pdf/ResultView';
import { SortableGrid, SortableItem } from '@/components/pdf/SortableGrid';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { Checkbox, StatRow } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { pickFiles } from '@/lib/utils/files';
import { baseName, ensurePdfName, formatBytes, plural } from '@/lib/utils/format';
import { mergePdfs } from './mergePdfs';

const tool = getTool('unir');

/** Un archivo en la lista (el mismo PDF puede aparecer varias veces). */
interface Entry {
  key: number;
  file: PdfFile;
}

let nextKey = 0;
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

export default function MergeTool() {
  const runTask = useBusyTask();
  const { loadMany } = usePdfLoader();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [blankAfterOdd, setBlankAfterOdd] = useState(false);
  const [outputName, setOutputName] = useState('unido.pdf');
  const [result, setResult] = useState<{ file: ResultFile; pageCount: number } | null>(null);

  useUnsavedWarning(entries.length > 0 && !result);

  const addFiles = async (files: File[]) => {
    const loaded = await loadMany(files);
    if (!loaded.length) return;
    if (!entries.length) setOutputName(`${baseName(loaded[0].name)}_unido.pdf`);
    setEntries((list) => [...list, ...loaded.map((file) => ({ key: nextKey++, file }))]);
  };
  useHandoff(addFiles);

  const sortBy = (mode: 'az' | 'za' | 'reverse') => setEntries((list) => {
    const sorted = [...list];
    if (mode === 'az') sorted.sort((a, b) => collator.compare(a.file.name, b.file.name));
    if (mode === 'za') sorted.sort((a, b) => collator.compare(b.file.name, a.file.name));
    if (mode === 'reverse') sorted.reverse();
    return sorted;
  });

  const merge = () => runTask('Uniendo PDFs…', async (progress) => {
    const { bytes, pageCount } = await mergePdfs(entries.map((e) => e.file), {
      blankAfterOddDocuments: blankAfterOdd,
      onProgress: progress.setProgress,
    });
    setResult({ file: { type: 'pdf', name: ensurePdfName(outputName, 'unido'), bytes }, pageCount });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title="¡PDFs unidos!"
          subtitle={<>{plural(entries.length, 'archivo', 'archivos')} → <b>{result.file.name}</b> · {plural(result.pageCount, 'página', 'páginas')} · {formatBytes(resultSize(result.file))}</>}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!entries.length) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta aquí los PDFs que quieres unir" subtitle="Puedes elegir varios a la vez" icon="merge" color={tool.color} onFiles={addFiles} />
      </ToolLayout>
    );
  }

  const totalPages = entries.reduce((sum, e) => sum + e.file.pageCount, 0);
  const totalSize = entries.reduce((sum, e) => sum + e.file.bytes.length, 0);

  const sidebar = (
    <>
      <SideBlock title="Resumen">
        <StatRow label="Archivos" value={entries.length} />
        <StatRow label="Páginas en total" value={totalPages} />
        <StatRow label="Tamaño aproximado" value={formatBytes(totalSize)} />
      </SideBlock>
      <SideBlock title="Opciones">
        <Checkbox checked={blankAfterOdd} onChange={setBlankAfterOdd} hint="Útil para imprimir a doble cara: cada documento empieza en hoja nueva.">
          Página en blanco tras documentos con páginas impares
        </Checkbox>
      </SideBlock>
      <SideBlock>
        <Field label="Nombre del archivo">
          {(id) => <input id={id} className="input" value={outputName} onChange={(e) => setOutputName(e.target.value)} />}
        </Field>
      </SideBlock>
    </>
  );

  const footer = (
    <>
      {entries.length < 2 && <span className="hint" style={{ textAlign: 'center' }}>Añade al menos 2 PDFs</span>}
      <Button variant="primary" size="lg" icon="merge" disabled={entries.length < 2} onClick={() => void merge()}>
        Unir {entries.length} PDFs
      </Button>
    </>
  );

  return (
    <ToolLayout tool={tool} sidebar={sidebar} sidebarFooter={footer}>
      <WindowDrop label="Suelta para añadir PDFs" active onFiles={addFiles} />
      <div className="toolbar">
        <Button icon="plus" onClick={async () => addFiles(await pickFiles())}>Añadir PDFs</Button>
        <div className="toolbar-group">
          <Button size="sm" variant="ghost" title="Ordenar por nombre A→Z" onClick={() => sortBy('az')}>A→Z</Button>
          <Button size="sm" variant="ghost" title="Ordenar por nombre Z→A" onClick={() => sortBy('za')}>Z→A</Button>
          <Button size="sm" variant="ghost" icon="rotateCcw" title="Invertir orden" onClick={() => sortBy('reverse')}>Invertir</Button>
        </div>
        <span className="spacer" />
        <span className="hint"><Icon name="move" />Arrastra las tarjetas para cambiar el orden</span>
      </div>

      <SortableGrid
        className="file-grid"
        items={entries}
        getId={(e) => e.key}
        onReorder={setEntries}
        renderItem={(entry, index) => (
          <SortableItem key={entry.key} id={entry.key} className="file-card">
            <div className="file-order">{index + 1}</div>
            <div className="page-actions">
              <button type="button" title="Duplicar" onClick={() => setEntries((list) => {
                const copy = [...list];
                copy.splice(index + 1, 0, { key: nextKey++, file: entry.file });
                return copy;
              })}><Icon name="copy" /></button>
              <button type="button" title="Quitar" onClick={() => setEntries((list) => list.filter((e) => e.key !== entry.key))}>
                <Icon name="trash" />
              </button>
            </div>
            <div className="thumb-wrap">
              <div className={entry.file.pageCount > 1 ? 'file-stack multi' : 'file-stack'}>
                <PageThumbnail file={entry.file} pageIndex={0} width={220} />
              </div>
            </div>
            <div>
              <div className="file-name" title={entry.file.name}>
                <span className="src-dot" style={{ background: entry.file.color }} />{entry.file.name}
              </div>
              <div className="file-meta">
                <span>{plural(entry.file.pageCount, 'página', 'páginas')}</span>
                <span>{formatBytes(entry.file.bytes.length)}</span>
              </div>
            </div>
          </SortableItem>
        )}
        trailing={
          <button type="button" className="add-card" onClick={async () => addFiles(await pickFiles())}>
            <Icon name="plus" />Añadir más
          </button>
        }
      />
    </ToolLayout>
  );
}

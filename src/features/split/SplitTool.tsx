import { Fragment, useDeferredValue, useMemo, useState, type CSSProperties } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { OptionCards, RangeField, type ChoiceOption } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { rangesToText } from '@/lib/pdf/ranges';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { colorAt } from '@/lib/utils/colors';
import { downloadFile } from '@/lib/utils/files';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { createZip } from '@/lib/utils/zip';
import { computeGroups, cutsFromGroups, splitPdf, type SplitMode, type SplitPart } from './splitPdf';

const tool = getTool('dividir');

const MODES: ChoiceOption<SplitMode>[] = [
  { value: 'cuts', label: 'Cortes manuales', description: 'Marca con las tijeras dónde cortar', icon: 'scissors' },
  { value: 'everyN', label: 'Cada N páginas', description: 'Partes del mismo tamaño', icon: 'everyN' },
  { value: 'single', label: 'Todas separadas', description: 'Un archivo por página', icon: 'dotsSplit' },
  { value: 'ranges', label: 'Por rangos', description: 'Escribe rangos, ej. 1-3, 5, 8-10', icon: 'ranges' },
];

export default function SplitTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [mode, setMode] = useState<SplitMode>('cuts');
  const [cuts, setCuts] = useState<Set<number>>(new Set());
  const [everyN, setEveryN] = useState(2);
  const [rangesText, setRangesText] = useState('');
  const deferredRanges = useDeferredValue(rangesText);
  const [thumbSize, setThumbSize] = useState(130);
  const [result, setResult] = useState<{ file: ResultFile; parts: SplitPart[] } | null>(null);

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (!pdf) return;
    const half = Math.ceil(pdf.pageCount / 2);
    setFile(pdf);
    setResult(null);
    // Sugerencia inicial: cortar a la mitad
    setCuts(pdf.pageCount > 1 ? new Set([half - 1]) : new Set());
    setRangesText(pdf.pageCount > 1 ? `1-${half}, ${half + 1}-${pdf.pageCount}` : '1');
  };
  useHandoff(load);

  const { groups, error } = useMemo(
    () => (file ? computeGroups(file.pageCount, { mode, cuts, everyN, rangesText: deferredRanges }) : { groups: [], error: null }),
    [file, mode, cuts, everyN, deferredRanges],
  );

  const changeMode = (next: SplitMode) => {
    if (next === 'cuts' && mode !== 'cuts' && !error) setCuts(cutsFromGroups(groups));
    setMode(next);
  };

  /** Clic en unas tijeras: pasa a modo manual partiendo de lo que se ve. */
  const toggleCut = (afterPage: number) => {
    const base = mode === 'cuts' ? cuts : cutsFromGroups(groups);
    const next = new Set(base);
    if (next.has(afterPage)) next.delete(afterPage);
    else next.add(afterPage);
    setMode('cuts');
    setCuts(next);
  };

  const split = () => runTask('Dividiendo…', async (progress) => {
    if (!file) return;
    const parts = await splitPdf(file, groups, progress.setProgress);
    if (parts.length === 1) {
      setResult({ file: { type: 'pdf', ...parts[0] }, parts });
      return;
    }
    progress.setText('Creando ZIP…');
    const blob = await createZip(parts.map((p) => ({ name: p.name, data: p.bytes })));
    setResult({ file: { type: 'file', name: `${baseName(file.name)}_dividido.zip`, blob }, parts });
  });

  if (result && file) {
    const many = result.parts.length > 1;
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title={many ? `¡${result.parts.length} archivos creados!` : '¡PDF dividido!'}
          subtitle={many ? `Se descargan juntos en un ZIP (${formatBytes(resultSize(result.file))}). También puedes bajarlos uno por uno:` : undefined}
          onBack={() => setResult(null)}
        >
          {many && (
            <div className="groups-list scroll">
              {result.parts.map((part, k) => (
                <div key={part.name} className="group-row">
                  <span className="swatch" style={{ background: colorAt(k) }} />
                  <span className="gname" style={{ fontWeight: 500 }}>{part.name}</span>
                  <Button size="sm" variant="ghost" icon="download" title="Descargar solo este" onClick={() => downloadFile(part.bytes, part.name)} />
                </div>
              ))}
            </div>
          )}
        </ResultView>
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres dividir" multiple={false} icon="scissors" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  // Color de cada página según su grupo, y cortes visibles entre páginas consecutivas
  const pageColor = new Map<number, string>();
  groups.forEach((group, k) => group.forEach((page) => { if (!pageColor.has(page)) pageColor.set(page, colorAt(k)); }));
  const visibleCuts = mode === 'ranges' ? new Set<number>() : cutsFromGroups(groups);

  const sidebar = (
    <>
      <SideBlock title="Cómo dividir">
        <OptionCards options={MODES} value={mode} onChange={changeMode} />
      </SideBlock>
      {mode === 'everyN' && (
        <SideBlock>
          <RangeField label="Páginas por archivo" min={1} max={Math.max(1, file.pageCount)} value={everyN} onChange={setEveryN} />
        </SideBlock>
      )}
      {mode === 'ranges' && (
        <SideBlock>
          <Field label="Rangos (cada uno es un archivo)" hint={error ?? 'Separados por comas. "8-" = de la 8 al final.'} error={!!error}>
            {(id) => <input id={id} className="input" value={rangesText} placeholder="1-3, 4, 5-10" onChange={(e) => setRangesText(e.target.value)} />}
          </Field>
        </SideBlock>
      )}
      <SideBlock title={`Resultado: ${plural(groups.length, 'archivo', 'archivos')}`}>
        <div className="groups-list">
          {groups.slice(0, 60).map((group, k) => (
            <div key={k} className="group-row">
              <span className="swatch" style={{ background: colorAt(k) }} />
              <span className="gname">Parte {k + 1}</span>
              <span className="gpages">{group.length === 1 ? `pág. ${group[0] + 1}` : `págs. ${rangesToText(group)}`}</span>
            </div>
          ))}
          {groups.length > 60 && <div className="hint">…y {groups.length - 60} más</div>}
        </div>
      </SideBlock>
    </>
  );

  const footer = (
    <Button variant="primary" size="lg" icon="scissors" disabled={!groups.length} onClick={() => void split()}>
      Dividir en {plural(groups.length, 'archivo', 'archivos')}
    </Button>
  );

  return (
    <ToolLayout tool={tool} sidebar={sidebar} sidebarFooter={footer}>
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <div className="toolbar">
        <span className="hint"><Icon name="scissors" />Haz clic en las tijeras entre páginas para cortar. Cada color es un archivo nuevo.</span>
        <span className="spacer" />
        <div className="zoom-ctl">
          <input type="range" min={80} max={240} value={thumbSize} aria-label="Tamaño de las miniaturas" onChange={(e) => setThumbSize(Number(e.target.value))} />
        </div>
      </div>
      <div className="split-flow" style={{ '--thumb': `${thumbSize}px` } as CSSProperties}>
        {Array.from({ length: file.pageCount }, (_, i) => (
          <Fragment key={i}>
            <div
              className={pageColor.has(i) ? 'split-page' : 'split-page excluded'}
              style={{ '--group-color': pageColor.get(i) ?? 'transparent' } as CSSProperties}
            >
              <div className="thumb-wrap"><PageThumbnail file={file} pageIndex={i} width={220} /></div>
              <div className="page-label">{i + 1}</div>
            </div>
            {i < file.pageCount - 1 && (
              <div className={visibleCuts.has(i) ? 'split-gap cut' : 'split-gap'}>
                <button type="button" title="Cortar aquí" onClick={() => toggleCut(i)}><Icon name="scissors" /></button>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </ToolLayout>
  );
}

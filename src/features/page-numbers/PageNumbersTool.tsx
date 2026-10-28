import { useCallback, useState } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PagePreview, type PreviewOverlay } from '@/components/pdf/PagePreview';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { Checkbox, OptionCards, PositionGrid, RangeField } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { addPageNumbers } from './addPageNumbers';
import { ALLOWED_POSITIONS, DEFAULT_SETTINGS, labelAnchor, labelForPage, NUMBER_FORMATS, type NumberFormat, type PageNumberSettings } from './settings';

const tool = getTool('numerar');

const FORMAT_OPTIONS = (Object.keys(NUMBER_FORMATS) as NumberFormat[]).map((value) => ({ value, label: NUMBER_FORMATS[value].example }));

export default function PageNumbersTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [settings, setSettings] = useState<PageNumberSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<{ file: ResultFile; numbered: number } | null>(null);

  const set = <K extends keyof PageNumberSettings>(key: K, value: PageNumberSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (pdf) {
      setFile(pdf);
      setResult(null);
    }
  };
  useHandoff(load);

  const drawOverlay = useCallback<PreviewOverlay>((context, page) => {
    if (!file) return;
    const label = labelForPage(page.pageIndex, file.pageCount, settings);
    if (!label) return;
    context.font = `${settings.size}px Helvetica, Arial, sans-serif`;
    context.fillStyle = settings.color;
    const width = context.measureText(label).width;
    const { x, y } = labelAnchor(page.width, page.height, width, settings);
    context.fillText(label, x, y);
    // Resalta la zona del número
    context.strokeStyle = 'rgba(47, 158, 91, .6)';
    context.setLineDash([3, 3]);
    context.lineWidth = 1;
    context.strokeRect(x - 4, y - settings.size * 0.9, width + 8, settings.size * 1.25);
  }, [file, settings]);

  const apply = () => runTask('Numerando páginas…', async (progress) => {
    if (!file) return;
    const { bytes, numbered } = await addPageNumbers(file, settings, progress.setProgress);
    setResult({ file: { type: 'pdf', name: `${baseName(file.name)}_numerado.pdf`, bytes }, numbered });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title="¡Páginas numeradas!"
          subtitle={`${plural(result.numbered, 'página numerada', 'páginas numeradas')} · ${formatBytes(resultSize(result.file))}`}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres numerar" multiple={false} icon="hash" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const sidebar = (
    <>
      <SideBlock title="Posición">
        <PositionGrid value={settings.position} onChange={(v) => set('position', v)} allowed={ALLOWED_POSITIONS} />
      </SideBlock>
      <SideBlock title="Formato">
        <OptionCards compact options={FORMAT_OPTIONS} value={settings.format} onChange={(v) => set('format', v)} />
      </SideBlock>
      <SideBlock>
        <div className="field-row">
          <Field label="Empezar en">
            {(id) => (
              <input id={id} type="number" min={0} className="input" value={settings.start}
                onChange={(e) => set('start', Math.max(0, parseInt(e.target.value, 10) || 0))} />
            )}
          </Field>
          <Field label="Color">
            {(id) => <input id={id} type="color" value={settings.color} onChange={(e) => set('color', e.target.value)} />}
          </Field>
        </div>
        <Checkbox checked={settings.skipFirst} onChange={(v) => set('skipFirst', v)}>No numerar la primera página (portada)</Checkbox>
        <div style={{ marginTop: 10 }}>
          <RangeField label="Tamaño" min={6} max={36} value={settings.size} unit=" pt" onChange={(v) => set('size', v)} />
          <RangeField label="Margen" min={8} max={80} value={settings.margin} unit=" pt" onChange={(v) => set('margin', v)} />
        </div>
      </SideBlock>
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={<Button variant="primary" size="lg" icon="hash" onClick={() => void apply()}>Numerar páginas</Button>}
    >
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <PagePreview file={file} maxWidth={520} drawOverlay={drawOverlay} />
    </ToolLayout>
  );
}

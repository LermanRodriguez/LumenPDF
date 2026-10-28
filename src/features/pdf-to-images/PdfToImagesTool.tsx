import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { OptionCards, RangeField, Segmented } from '@/components/ui/controls';
import { SideBlock } from '@/components/ui/Field';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { allPages } from '@/lib/pdf/ranges';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { createZip } from '@/lib/utils/zip';
import { pdfToImages, type ImageFormat } from './pdfToImages';

const tool = getTool('pdf-a-imagenes');

export default function PdfToImagesTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<ImageFormat>('jpg');
  const [dpi, setDpi] = useState(150);
  const [quality, setQuality] = useState(90);
  const [result, setResult] = useState<{ file: ResultFile; count: number } | null>(null);

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (!pdf) return;
    setFile(pdf);
    setSelected(new Set(allPages(pdf.pageCount)));
    setResult(null);
  };
  useHandoff(load);

  const toggle = (index: number) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });

  const convert = () => runTask('Convirtiendo…', async (progress) => {
    if (!file) return;
    const pages = [...selected].sort((a, b) => a - b);
    const images = await pdfToImages(file, pages, { format, dpi, quality }, progress);
    if (images.length === 1) {
      setResult({ file: { type: 'file', name: images[0].name, blob: images[0].blob }, count: 1 });
      return;
    }
    progress.setText('Creando ZIP…');
    const blob = await createZip(images.map((image) => ({ name: image.name, data: image.blob })));
    setResult({ file: { type: 'file', name: `${baseName(file.name)}_imagenes.zip`, blob }, count: images.length });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        {result.count === 1 && result.file.type === 'file'
          ? <SingleImageResult result={result.file} onBack={() => setResult(null)} />
          : (
            <ResultView
              toolId={tool.id}
              result={result.file}
              title={`¡${result.count} imágenes listas!`}
              subtitle={`Descargadas en un ZIP · ${formatBytes(resultSize(result.file))}`}
              onBack={() => setResult(null)}
            />
          )}
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres convertir en imágenes" multiple={false} icon="fileImage" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const sidebar = (
    <>
      <SideBlock title="Formato">
        <OptionCards
          value={format}
          onChange={setFormat}
          options={[
            { value: 'jpg', label: 'JPG', description: 'Archivos ligeros, ideal para fotos', icon: 'image' },
            { value: 'png', label: 'PNG', description: 'Máxima nitidez para texto y gráficos', icon: 'fileImage' },
          ]}
        />
      </SideBlock>
      <SideBlock title="Resolución">
        <Segmented
          value={dpi}
          onChange={setDpi}
          options={[
            { value: 72, label: <b>72 ppp</b>, description: 'Pantalla' },
            { value: 150, label: <b>150 ppp</b>, description: 'Normal' },
            { value: 300, label: <b>300 ppp</b>, description: 'Impresión' },
          ]}
        />
      </SideBlock>
      {format === 'jpg' && (
        <SideBlock>
          <RangeField label="Calidad JPG" min={40} max={100} value={quality} unit="%" onChange={setQuality} />
        </SideBlock>
      )}
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={
        <Button variant="primary" size="lg" icon="download" disabled={!selected.size} onClick={() => void convert()}>
          Convertir {plural(selected.size, 'página', 'páginas')}
        </Button>
      }
    >
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <div className="toolbar">
        <Button size="sm" icon="selectAll" onClick={() => setSelected(new Set(allPages(file.pageCount)))}>Todas</Button>
        <Button size="sm" onClick={() => setSelected(new Set())}>Ninguna</Button>
        <span className="spacer" />
        <span className="hint">{selected.size} de {file.pageCount} páginas seleccionadas</span>
      </div>
      <div className="page-grid selecting" style={{ '--thumb': '140px' } as CSSProperties}>
        {allPages(file.pageCount).map((index) => (
          <div key={index} className={`page-item static${selected.has(index) ? ' selected' : ''}`} onClick={() => toggle(index)}>
            <div className="page-check" />
            <div className="thumb-wrap"><PageThumbnail file={file} pageIndex={index} width={220} /></div>
            <div className="page-label">{index + 1}</div>
          </div>
        ))}
      </div>
    </ToolLayout>
  );
}

/** Resultado de una sola imagen: se muestra la imagen generada. */
function SingleImageResult({ result, onBack }: { result: Extract<ResultFile, { type: 'file' }>; onBack: () => void }) {
  const url = useMemo(() => URL.createObjectURL(result.blob), [result]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <ResultView toolId={tool.id} result={result} title="¡Imagen lista!" onBack={onBack}>
      <img className="result-preview" src={url} alt="Página convertida" />
    </ResultView>
  );
}

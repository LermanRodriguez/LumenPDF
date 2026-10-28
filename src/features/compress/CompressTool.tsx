import { useEffect, useState, type CSSProperties } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import { NoticeView, ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { InfoBox, OptionCards, StatRow, type ChoiceOption } from '@/components/ui/controls';
import { SideBlock } from '@/components/ui/Field';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import type { PdfFile } from '@/lib/pdf/types';
import { downloadFile } from '@/lib/utils/files';
import { baseName, formatBytes } from '@/lib/utils/format';
import { compressPdf, type CompressionLevel } from './compressPdf';

const tool = getTool('comprimir');
const PREVIEW_PAGES = 24;

const LEVELS: ChoiceOption<CompressionLevel>[] = [
  { value: 'lossless', label: 'Sin pérdida', description: 'Reorganiza y recomprime. Calidad idéntica, texto intacto.', icon: 'check' },
  { value: 'recommended', label: 'Recomendada', description: 'Páginas a imagen de buena calidad (150 ppp). Mucho más ligero.', icon: 'sparkle' },
  { value: 'maximum', label: 'Máxima', description: 'Imagen a 96 ppp, calidad media. Lo más pequeño posible.', icon: 'compress' },
];

interface Outcome {
  bytes: Uint8Array;
  name: string;
  before: number;
  level: CompressionLevel;
}

export default function CompressTool() {
  const runTask = useBusyTask();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('recommended');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (pdf) {
      setFile(pdf);
      setOutcome(null);
    }
  };
  useHandoff(load);

  const compress = () => runTask('Comprimiendo…', async (progress) => {
    if (!file) return;
    const bytes = await compressPdf(file, level, progress);
    setOutcome({ bytes, name: `${baseName(file.name)}_comprimido.pdf`, before: file.bytes.length, level });
  });

  if (outcome) {
    const saved = outcome.before - outcome.bytes.length;
    if (saved <= 0) {
      return (
        <ToolLayout tool={tool}>
          <NoticeView
            title="Este PDF ya está muy optimizado"
            subtitle={<>
              Con el nivel "{LEVELS.find((l) => l.value === outcome.level)?.label}" quedaría en {formatBytes(outcome.bytes.length)} (original: {formatBytes(outcome.before)}).
              Te recomendamos conservar el original{outcome.level === 'lossless' ? ' o probar un nivel más fuerte' : ''}.
            </>}
            actions={<>
              <Button variant="primary" size="lg" icon="arrowLeft" onClick={() => setOutcome(null)}>Probar otro nivel</Button>
              <Button size="lg" icon="download" onClick={() => downloadFile(outcome.bytes, outcome.name)}>Descargar de todos modos</Button>
            </>}
          />
        </ToolLayout>
      );
    }
    const percent = Math.round((saved / outcome.before) * 100);
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={{ type: 'pdf', name: outcome.name, bytes: outcome.bytes }}
          title={`¡${percent}% más ligero!`}
          subtitle={<b>{outcome.name}</b>}
          onBack={() => setOutcome(null)}
        >
          <SizeComparison before={outcome.before} after={outcome.bytes.length} percent={percent} />
        </ResultView>
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres comprimir" multiple={false} icon="compress" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const sidebar = (
    <>
      <SideBlock title="Nivel de compresión">
        <OptionCards options={LEVELS} value={level} onChange={setLevel} />
      </SideBlock>
      <SideBlock>
        {level === 'lossless'
          ? <InfoBox>Ideal para documentos de texto. Si el PDF tiene muchas fotos, prueba "Recomendada".</InfoBox>
          : <InfoBox warn>Las páginas se convierten en imágenes: el texto dejará de ser seleccionable y los enlaces/formularios se pierden. Ideal para documentos escaneados.</InfoBox>}
      </SideBlock>
      <SideBlock>
        <StatRow label="Tamaño actual" value={formatBytes(file.bytes.length)} />
        <StatRow label="Páginas" value={file.pageCount} />
      </SideBlock>
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={<Button variant="primary" size="lg" icon="compress" onClick={() => void compress()}>Comprimir PDF</Button>}
    >
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <div className="page-grid" style={{ '--thumb': '120px' } as CSSProperties}>
        {Array.from({ length: Math.min(file.pageCount, PREVIEW_PAGES) }, (_, i) => (
          <div key={i} className="page-item static" style={{ cursor: 'default' }}>
            <div className="thumb-wrap"><PageThumbnail file={file} pageIndex={i} width={200} /></div>
            <div className="page-label">{i + 1}</div>
          </div>
        ))}
      </div>
      {file.pageCount > PREVIEW_PAGES && <p className="hint" style={{ textAlign: 'center' }}>…y {file.pageCount - PREVIEW_PAGES} páginas más</p>}
    </ToolLayout>
  );
}

/** Comparación visual del tamaño antes y después. */
function SizeComparison({ before, after, percent }: { before: number; after: number; percent: number }) {
  // La barra se anima desde 100% hasta el tamaño final
  const [barWidth, setBarWidth] = useState(100);
  useEffect(() => {
    const timer = setTimeout(() => setBarWidth(Math.max(2, 100 - percent)), 60);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <>
      <div className="size-compare">
        <div className="size-box"><div className="sb-label">Antes</div><div className="sb-val">{formatBytes(before)}</div></div>
        <div className="arrow">→</div>
        <div className="size-box"><div className="sb-label">Después</div><div className="sb-val good">{formatBytes(after)}</div></div>
      </div>
      <div className="bar-compare"><div style={{ width: `${barWidth}%` }} /></div>
      <p className="size-saving">Ahorraste {formatBytes(before - after)}</p>
    </>
  );
}

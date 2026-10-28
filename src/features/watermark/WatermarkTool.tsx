import { useCallback, useState } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { useToast } from '@/app/providers/toast-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { DocSummary } from '@/components/pdf/DocSummary';
import { Dropzone } from '@/components/pdf/Dropzone';
import { PagePreview, type PreviewOverlay } from '@/components/pdf/PagePreview';
import { ResultView } from '@/components/pdf/ResultView';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { Checkbox, ColorSwatches, RangeField, Segmented } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { prepareImage } from '@/lib/pdf/images';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { IMAGE_ACCEPT, pickFiles } from '@/lib/utils/files';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { applyWatermark } from './applyWatermark';
import { DEFAULT_SETTINGS, resolveTargetPages, WATERMARK_COLORS, WATERMARK_FONTS, watermarkPositions, type WatermarkFont, type WatermarkSettings } from './settings';

const tool = getTool('marca-agua');

export default function WatermarkTool() {
  const runTask = useBusyTask();
  const toast = useToast();
  const { loadOne } = usePdfLoader();
  const [file, setFile] = useState<PdfFile | null>(null);
  const [settings, setSettings] = useState<WatermarkSettings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<{ file: ResultFile; pageCount: number } | null>(null);

  const set = <K extends keyof WatermarkSettings>(key: K, value: WatermarkSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (pdf) {
      setFile(pdf);
      setResult(null);
    }
  };
  useHandoff(load);

  const pickImage = async () => {
    const [imageFile] = await pickFiles({ accept: IMAGE_ACCEPT, multiple: false });
    if (!imageFile) return;
    const prepared = await prepareImage(imageFile);
    const url = URL.createObjectURL(new Blob([prepared.bytes as BlobPart], { type: prepared.type === 'jpg' ? 'image/jpeg' : 'image/png' }));
    const element = new Image();
    element.src = url;
    await element.decode();
    set('image', { ...prepared, url, element });
  };

  /** Dibuja la marca sobre la vista previa con la misma lógica de posiciones que el PDF. */
  const drawOverlay = useCallback<PreviewOverlay>((context, page) => {
    if (!file) return;
    const { pages } = resolveTargetPages(file.pageCount, settings);
    if (!pages.includes(page.pageIndex)) return;
    context.globalAlpha = settings.opacity / 100;
    const rotate = (x: number, y: number, draw: () => void) => {
      context.save();
      context.translate(x, y);
      context.rotate((-settings.angle * Math.PI) / 180);
      draw();
      context.restore();
    };
    if (settings.type === 'text' && settings.text) {
      context.font = WATERMARK_FONTS[settings.font].css(settings.size);
      context.fillStyle = settings.color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const width = context.measureText(settings.text).width;
      for (const [x, y] of watermarkPositions(page.width, page.height, width, settings.size, settings)) {
        rotate(x, y, () => context.fillText(settings.text, 0, 0));
      }
    } else if (settings.type === 'image' && settings.image) {
      const { image } = settings;
      const width = (page.width * settings.imageScale) / 100;
      const height = (width * image.height) / image.width;
      for (const [x, y] of watermarkPositions(page.width, page.height, width, height, settings)) {
        rotate(x, y, () => context.drawImage(image.element, -width / 2, -height / 2, width, height));
      }
    }
  }, [file, settings]);

  const apply = () => {
    if (!file) return;
    const { pages, error } = resolveTargetPages(file.pageCount, settings);
    if (error || !pages.length) return toast(error ?? 'Elige al menos una página', 'warn');
    if (settings.type === 'text' && !settings.text.trim()) return toast('Escribe el texto de la marca de agua', 'warn');
    if (settings.type === 'image' && !settings.image) return toast('Elige una imagen', 'warn');
    void runTask('Aplicando marca de agua…', async (progress) => {
      const { bytes, replacedChars } = await applyWatermark(file, pages, settings, progress.setProgress);
      if (replacedChars) toast('Algunos caracteres no son compatibles y se reemplazaron por "?"', 'warn');
      setResult({ file: { type: 'pdf', name: `${baseName(file.name)}_marca.pdf`, bytes }, pageCount: pages.length });
    });
  };

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title="¡Marca de agua aplicada!"
          subtitle={`${plural(result.pageCount, 'página marcada', 'páginas marcadas')} · ${formatBytes(resultSize(result.file))}`}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF al que quieres poner marca de agua" multiple={false} icon="droplet" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const rangeInfo = settings.pages === 'range' ? resolveTargetPages(file.pageCount, settings) : null;

  const sidebar = (
    <>
      <SideBlock>
        <Segmented
          value={settings.type}
          onChange={(v) => set('type', v)}
          options={[{ value: 'text', label: 'Texto', icon: 'text' }, { value: 'image', label: 'Imagen', icon: 'image' }]}
        />
      </SideBlock>

      {settings.type === 'text' ? (
        <SideBlock>
          <Field label="Texto">
            {(id) => <input id={id} className="input" value={settings.text} onChange={(e) => set('text', e.target.value)} />}
          </Field>
          <Field label="Fuente">
            {(id) => (
              <select id={id} className="input" value={settings.font} onChange={(e) => set('font', e.target.value as WatermarkFont)}>
                {Object.entries(WATERMARK_FONTS).map(([key, font]) => <option key={key} value={key}>{font.label}</option>)}
              </select>
            )}
          </Field>
          <RangeField label="Tamaño" min={10} max={200} value={settings.size} unit=" pt" onChange={(v) => set('size', v)} />
          <Field label="Color"><ColorSwatches colors={WATERMARK_COLORS} value={settings.color} onChange={(c) => set('color', c)} /></Field>
        </SideBlock>
      ) : (
        <SideBlock>
          <Button icon="image" style={{ width: '100%' }} onClick={() => void pickImage()}>
            {settings.image ? 'Cambiar imagen' : 'Elegir imagen (logo)'}
          </Button>
          {settings.image && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--surface-2)', textAlign: 'center' }}>
              <img src={settings.image.url} alt="Marca de agua" style={{ maxHeight: 70, maxWidth: '100%' }} />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <RangeField label="Tamaño (ancho de página)" min={5} max={100} value={settings.imageScale} unit="%" onChange={(v) => set('imageScale', v)} />
          </div>
        </SideBlock>
      )}

      <SideBlock>
        <RangeField label="Opacidad" min={5} max={100} value={settings.opacity} unit="%" onChange={(v) => set('opacity', v)} />
        <Field label="Rotación">
          <Segmented
            value={settings.angle}
            onChange={(v) => set('angle', v)}
            options={[0, 45, 90, -45].map((a) => ({ value: a, label: `${a}°` }))}
          />
        </Field>
        <RangeField label="Ángulo exacto" min={-180} max={180} value={settings.angle} unit="°" onChange={(v) => set('angle', v)} />
        <Field label="Disposición">
          <Segmented
            value={settings.layout}
            onChange={(v) => set('layout', v)}
            options={[{ value: 'center', label: 'Centrada', icon: 'center' }, { value: 'tile', label: 'Mosaico', icon: 'tile' }]}
          />
        </Field>
        <Checkbox checked={settings.behindContent} onChange={(v) => set('behindContent', v)} hint="En documentos escaneados quedaría oculta.">
          Detrás del contenido
        </Checkbox>
      </SideBlock>

      <SideBlock>
        <Field label="Páginas">
          <Segmented value={settings.pages} onChange={(v) => set('pages', v)} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Elegir' }]} />
        </Field>
        {rangeInfo && (
          <Field
            hint={rangeInfo.error ?? (settings.rangeText ? plural(rangeInfo.pages.length, 'página', 'páginas') : 'Escribe las páginas')}
            error={!!rangeInfo.error}
          >
            <input className="input" value={settings.rangeText} placeholder="Ej: 1-3, 5" onChange={(e) => set('rangeText', e.target.value)} />
          </Field>
        )}
      </SideBlock>
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={<Button variant="primary" size="lg" icon="droplet" onClick={apply}>Aplicar marca de agua</Button>}
    >
      <WindowDrop label="Suelta para cambiar de PDF" active onFiles={load} />
      <DocSummary file={file} onChangeFile={load} />
      <PagePreview file={file} maxWidth={560} drawOverlay={drawOverlay} />
    </ToolLayout>
  );
}


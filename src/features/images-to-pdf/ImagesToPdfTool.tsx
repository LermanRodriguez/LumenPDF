import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { useToast } from '@/app/providers/toast-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Dropzone } from '@/components/pdf/Dropzone';
import { ResultView } from '@/components/pdf/ResultView';
import { SortableGrid, SortableItem } from '@/components/pdf/SortableGrid';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { OptionCards, Segmented } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { getTool } from '@/features/catalog';
import { useFitScale } from '@/hooks/useFitScale';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { resultSize, type ResultFile } from '@/lib/pdf/types';
import { IMAGE_ACCEPT, isImageFile, pickFiles } from '@/lib/utils/files';
import { baseName, ensurePdfName, formatBytes, plural } from '@/lib/utils/format';
import { imagesToPdf, MARGINS, PAGE_SIZES, type ImageEntry, type MarginOption, type Orientation, type PageSizeOption } from './imagesToPdf';

const tool = getTool('imagenes-a-pdf');

interface ImageItem extends ImageEntry {
  id: number;
  /** URL blob: para la miniatura. */
  url: string;
}

let nextId = 0;

export default function ImagesToPdfTool() {
  const runTask = useBusyTask();
  const toast = useToast();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<MarginOption>('small');
  const [outputName, setOutputName] = useState('imagenes.pdf');
  const [result, setResult] = useState<ResultFile | null>(null);

  useUnsavedWarning(images.length > 0 && !result);

  // URLs de miniaturas creadas: se liberan al salir de la herramienta
  const thumbnailUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = thumbnailUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const addImages = (files: File[]) => {
    const valid = files.filter(isImageFile);
    if (valid.length < files.length) toast(`Se ignoraron ${files.length - valid.length} archivo(s) que no son imágenes`, 'warn');
    if (!valid.length) return;
    if (!images.length) setOutputName(`${baseName(valid[0].name)}.pdf`);
    const added = valid.map((file) => ({ id: nextId++, file, url: URL.createObjectURL(file), rotation: 0 }));
    added.forEach((image) => thumbnailUrls.current.add(image.url));
    setImages((list) => [...list, ...added]);
  };

  const removeImage = (image: ImageItem) => {
    URL.revokeObjectURL(image.url);
    thumbnailUrls.current.delete(image.url);
    setImages((list) => list.filter((i) => i.id !== image.id));
  };

  const rotateImage = (image: ImageItem) =>
    setImages((list) => list.map((i) => (i.id === image.id ? { ...i, rotation: (i.rotation + 90) % 360 } : i)));

  const build = () => runTask('Creando PDF…', async (progress) => {
    const bytes = await imagesToPdf(images, { pageSize, orientation, margin }, progress.setProgress);
    setResult({ type: 'pdf', name: ensurePdfName(outputName, 'imagenes'), bytes });
  });

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result}
          title="¡PDF creado!"
          subtitle={<><b>{result.name}</b> · {plural(images.length, 'página', 'páginas')} · {formatBytes(resultSize(result))}</>}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!images.length) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone
          title="Suelta aquí tus imágenes"
          subtitle="JPG, PNG, WEBP, GIF o BMP · puedes elegir varias"
          accept={IMAGE_ACCEPT}
          icon="images"
          color={tool.color}
          buttonLabel="Elegir imágenes"
          onFiles={addImages}
        />
      </ToolLayout>
    );
  }

  const sidebar = (
    <>
      <SideBlock title="Tamaño de página">
        <OptionCards
          compact
          options={(Object.keys(PAGE_SIZES) as PageSizeOption[]).map((value) => ({ value, label: PAGE_SIZES[value].label }))}
          value={pageSize}
          onChange={setPageSize}
        />
      </SideBlock>
      {pageSize !== 'fit' && (
        <SideBlock title="Orientación">
          <Segmented
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: 'auto', label: 'Auto', icon: 'sparkle' },
              { value: 'portrait', label: 'Vertical', icon: 'portrait' },
              { value: 'landscape', label: 'Horizontal', icon: 'landscape' },
            ]}
          />
        </SideBlock>
      )}
      <SideBlock title="Margen">
        <Segmented
          value={margin}
          onChange={setMargin}
          options={(Object.keys(MARGINS) as MarginOption[]).map((value) => ({ value, label: MARGINS[value].label }))}
        />
      </SideBlock>
      <SideBlock>
        <Field label="Nombre del archivo">
          {(id) => <input id={id} className="input" value={outputName} onChange={(e) => setOutputName(e.target.value)} />}
        </Field>
      </SideBlock>
    </>
  );

  return (
    <ToolLayout
      tool={tool}
      sidebar={sidebar}
      sidebarFooter={<Button variant="primary" size="lg" icon="fileImage" onClick={() => void build()}>Crear PDF ({plural(images.length, 'imagen', 'imágenes')})</Button>}
    >
      <WindowDrop label="Suelta para añadir imágenes" active onFiles={addImages} />
      <div className="toolbar">
        <Button icon="plus" onClick={async () => addImages(await pickFiles({ accept: IMAGE_ACCEPT }))}>Añadir imágenes</Button>
        <span className="spacer" />
        <span className="hint"><Icon name="move" />Arrastra para ordenar · cada imagen será una página</span>
      </div>
      <SortableGrid
        className="page-grid"
        style={{ '--thumb': '160px' } as CSSProperties}
        items={images}
        getId={(i) => i.id}
        onReorder={setImages}
        renderItem={(image, index) => (
          <SortableItem key={image.id} id={image.id} className="page-item">
            <div className="page-actions">
              <button type="button" title="Girar" onClick={() => rotateImage(image)}><Icon name="rotateCw" /></button>
              <button type="button" title="Quitar" onClick={() => removeImage(image)}><Icon name="trash" /></button>
            </div>
            <div className="thumb-wrap"><RotatableImage url={image.url} rotation={image.rotation} /></div>
            <div className="page-label">
              <span>{index + 1}</span>·<span className="ellipsis">{image.file.name}</span>
            </div>
          </SortableItem>
        )}
      />
    </ToolLayout>
  );
}

function RotatableImage({ url, rotation }: { url: string; rotation: number }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const scale = useFitScale(ref, rotation, loaded);
  return (
    <img
      ref={ref}
      className="thumb"
      src={url}
      alt=""
      draggable={false}
      onLoad={() => setLoaded(true)}
      style={{ objectFit: 'contain', transform: rotation ? `rotate(${rotation}deg) scale(${scale})` : undefined }}
    />
  );
}

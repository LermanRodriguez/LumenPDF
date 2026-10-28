import { useCallback, useRef, useState } from 'react';
import type { PageViewport, PDFPageProxy } from 'pdfjs-dist';
import { useBusyTask } from '@/app/providers/busy-context';
import { useDialogs } from '@/app/providers/dialog-context';
import { useToast } from '@/app/providers/toast-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Dropzone } from '@/components/pdf/Dropzone';
import { ResultView } from '@/components/pdf/ResultView';
import { Button } from '@/components/ui/Button';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { bytesToDataUrl, prepareImage } from '@/lib/pdf/images';
import { getPdfJsDocument } from '@/lib/pdf/pdfjs';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { IMAGE_ACCEPT, pickFiles } from '@/lib/utils/files';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { EditorObjectView } from './components/EditorObjectView';
import { EditorPage } from './components/EditorPage';
import { EditorToolbar } from './components/EditorToolbar';
import { PageStrip } from './components/PageStrip';
import { PropertiesPanel } from './components/PropertiesPanel';
import { DEFAULT_STYLES, STAMPS, type ToolbarAction } from './constants';
import { exportPdf } from './exportPdf';
import { SignatureDialog } from './signature/SignatureDialog';
import type { EditorObject, SignatureImage, StyleDefaults, ToolMode } from './types';
import { useEditorObjects, type NewEditorObject, type UnplacedEditorObject } from './useEditorObjects';

const tool = getTool('editar');
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

interface LoadedPage {
  page: PDFPageProxy;
  /** Vista a escala 1: define las "unidades de página". */
  viewport: PageViewport;
}

/** Texto que se está editando y cómo estaba al empezar (para el historial). */
interface EditingState {
  id: number;
  originalText: string;
  isNew: boolean;
}

export default function EditTool() {
  const runTask = useBusyTask();
  const toast = useToast();
  const dialogs = useDialogs();
  const { loadOne } = usePdfLoader();
  const editor = useEditorObjects();
  const { objects, selected } = editor;

  const [file, setFile] = useState<PdfFile | null>(null);
  const [pages, setPages] = useState<LoadedPage[]>([]);
  const [mode, setMode] = useState<ToolMode>('select');
  const [styles, setStyles] = useState<StyleDefaults>(DEFAULT_STYLES);
  /** null = ajustar al ancho disponible. */
  const [zoomOverride, setZoomOverride] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [signatures, setSignatures] = useState<SignatureImage[]>([]);
  const [result, setResult] = useState<ResultFile | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const visiblePages = useRef(new Set<number>());

  useUnsavedWarning(objects.length > 0 && !result);

  /* ================= Carga ================= */

  const load = async (files: File[]) => {
    const pdf = await loadOne(files);
    if (!pdf) return;
    const loaded = await runTask('Preparando editor…', async () => {
      const doc = await getPdfJsDocument(pdf);
      const list: LoadedPage[] = [];
      for (let i = 1; i <= pdf.pageCount; i++) {
        const page = await doc.getPage(i);
        list.push({ page, viewport: page.getViewport({ scale: 1 }) });
      }
      return list;
    });
    if (!loaded) return;
    editor.reset();
    setEditing(null);
    setMode('select');
    setCurrentPage(0);
    setZoomOverride(null);
    setResult(null);
    setPages(loaded);
    setFile(pdf);
  };
  useHandoff(load);

  /* ================= Zoom ================= */

  const fitZoom = (() => {
    if (!scrollElement || !pages.length) return 1;
    const widest = Math.max(...pages.map((p) => p.viewport.width));
    return Math.max(0.3, Math.min(2.5, (scrollElement.clientWidth - 60) / widest));
  })();
  const zoom = zoomOverride ?? fitZoom;

  const changeZoom = (value: number) => setZoomOverride(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)));

  /* ================= Páginas visibles ================= */

  const onVisibilityChange = useCallback((pageIndex: number, isVisible: boolean) => {
    if (isVisible) visiblePages.current.add(pageIndex);
    else visiblePages.current.delete(pageIndex);
    if (visiblePages.current.size) setCurrentPage(Math.min(...visiblePages.current));
  }, []);

  const scrollToPage = (pageIndex: number) => {
    const element = scrollElement?.querySelectorAll<HTMLElement>('.ed-page')[pageIndex];
    if (element && scrollElement) scrollElement.scrollTo({ top: element.offsetTop - 30, behavior: 'smooth' });
    setCurrentPage(pageIndex);
  };

  /* ================= Edición de texto ================= */

  const startEditing = (object: EditorObject, isNew = false) => {
    if (object.kind !== 'text') return;
    if (!isNew) editor.checkpoint();
    editor.select(object.id);
    setEditing({ id: object.id, originalText: object.text, isNew });
  };

  const stopEditing = () => {
    if (!editing) return;
    const object = objects.find((o) => o.id === editing.id);
    setEditing(null);
    if (!object || object.kind !== 'text') return;
    if (!object.text.trim()) {
      // Texto vacío: se elimina (si era nuevo, como si nunca se hubiera creado)
      if (editing.isNew) editor.dropCheckpoint();
      editor.remove(object.id, false);
    } else if (!editing.isNew && object.text === editing.originalText) {
      editor.dropCheckpoint();
    }
  };

  /* ================= Creación de objetos ================= */

  const switchMode = (next: ToolMode) => {
    stopEditing();
    setMode(next);
    if (next !== 'select') editor.select(null);
  };

  const create = (object: NewEditorObject) => {
    editor.add(object);
    // Resaltar y dibujar suelen usarse varias veces seguidas
    if (object.kind !== 'highlight' && object.kind !== 'draw') setMode('select');
  };

  const createText = (pageIndex: number, x: number, y: number) => {
    const style = styles.text;
    const created = editor.add({ kind: 'text', page: pageIndex, x, y: y - (style.size * 1.2) / 2, w: 10, h: 10, text: '', ...style });
    setMode('select');
    startEditing(created, true);
  };

  /** Coloca un objeto en el centro de la página visible. */
  const placeCentered = (object: UnplacedEditorObject) => {
    const { viewport } = pages[currentPage];
    create({ ...object, page: currentPage, x: (viewport.width - object.w) / 2, y: (viewport.height - object.h) / 2 } as NewEditorObject);
    setMode('select');
  };

  const placeImage = (src: string, width: number, height: number, maxWidth = 220) => {
    const w = Math.min(maxWidth, pages[currentPage].viewport.width * 0.6);
    placeCentered({ kind: 'image', src, w, h: (w * height) / width, opacity: 1 });
  };

  const onToolbarAction = async (action: ToolbarAction) => {
    stopEditing();
    switch (action) {
      case 'signature': {
        const signature = await dialogs.open<SignatureImage>((close) => <SignatureDialog onClose={close} />);
        if (!signature) return;
        setSignatures((list) => [...list, signature]);
        placeImage(signature.src, signature.width, signature.height, 170);
        return;
      }
      case 'image': {
        const [imageFile] = await pickFiles({ accept: IMAGE_ACCEPT, multiple: false });
        if (!imageFile) return;
        await runTask('Cargando imagen…', async () => {
          const image = await prepareImage(imageFile);
          placeImage(bytesToDataUrl(image.bytes, image.type === 'jpg' ? 'image/jpeg' : 'image/png'), image.width, image.height);
        });
        return;
      }
      case 'date': {
        const text = new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const { size } = styles.text;
        placeCentered({ kind: 'text', text, w: text.length * size * 0.55, h: size * 1.2, ...styles.text });
        return;
      }
      case 'check':
      case 'cross': {
        const stamp = STAMPS[action];
        placeCentered({ kind: 'draw', w: 24, h: 24, strokes: stamp.strokes, stroke: stamp.color, strokeWidth: 3, opacity: 1 });
        return;
      }
    }
  };

  /* ================= Estilos ================= */

  // Los deslizadores cambian en vivo; se guarda un solo punto de historial por "arrastre"
  const sliderSession = useRef<number | null>(null);

  const changeStyle = (changes: Partial<EditorObject>, record: boolean) => {
    const kind = selected?.kind ?? mode;
    if (selected) {
      if (record) editor.patch(selected.id, changes);
      else {
        if (sliderSession.current === null) editor.checkpoint();
        else clearTimeout(sliderSession.current);
        sliderSession.current = window.setTimeout(() => { sliderSession.current = null; }, 700);
        editor.patch(selected.id, changes, false);
      }
    }
    // Lo elegido también se usa para los siguientes elementos de ese tipo
    if (kind in styles) {
      const key = kind as keyof StyleDefaults;
      const current = styles[key] as Record<string, unknown>;
      const relevant = Object.fromEntries(Object.entries(changes).filter(([prop]) => prop in current));
      setStyles((s) => ({ ...s, [key]: { ...s[key], ...relevant } }));
    }
  };

  /* ================= Teclado ================= */

  useKeyboardShortcuts((event, ctrl) => {
    if (!file || result) return;
    if (ctrl && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (!editor.undo()) toast('Nada que deshacer', 'info');
      return;
    }
    if (event.key === 'Escape') {
      editor.select(null);
      setMode('select');
      return;
    }
    if (!selected) return;
    if (ctrl && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      editor.duplicate(selected.id);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      editor.remove(selected.id);
    } else if (event.key === 'Enter' && selected.kind === 'text') {
      event.preventDefault();
      startEditing(selected);
    } else {
      const step = event.shiftKey ? 10 : 1;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (delta) {
        event.preventDefault();
        editor.patch(selected.id, { x: selected.x + delta[0], y: selected.y + delta[1] });
      }
    }
  });

  /* ================= Guardar ================= */

  const save = () => {
    // El texto en edición ya está en el estado (se guarda con cada tecla)
    stopEditing();
    void runTask('Guardando PDF…', async () => {
      if (!file) return;
      const { bytes, replacedChars } = await exportPdf(file, objects, pages.map((p) => p.viewport));
      if (replacedChars) toast('Algunos caracteres especiales (emojis, etc.) no son compatibles y se reemplazaron por "?"', 'warn', 7000);
      setResult({ type: 'pdf', name: `${baseName(file.name)}_editado.pdf`, bytes });
    });
  };

  const openAnother = async () => {
    if (objects.length && !(await dialogs.confirm('¿Abrir otro PDF?', 'Se perderán los cambios no guardados.', 'Abrir otro'))) return;
    const files = await pickFiles({ multiple: false });
    if (files.length) void load(files);
  };

  /* ================= Pantallas ================= */

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result}
          title="¡PDF guardado!"
          subtitle={<><b>{result.name}</b> · {plural(objects.length, 'elemento añadido', 'elementos añadidos')} · {formatBytes(resultSize(result))}</>}
          onBack={() => setResult(null)}
          backLabel="Seguir editando"
        />
      </ToolLayout>
    );
  }

  if (!file) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta el PDF que quieres editar o firmar" multiple={false} icon="edit" color={tool.color} buttonLabel="Elegir PDF" onFiles={load} />
      </ToolLayout>
    );
  }

  const renderObject = (object: EditorObject) => {
    const { viewport } = pages[object.page];
    return (
      <EditorObjectView
        key={object.id}
        object={object}
        zoom={zoom}
        pageWidth={viewport.width}
        pageHeight={viewport.height}
        selected={selected?.id === object.id}
        editing={editing?.id === object.id}
        onSelect={() => {
          if (editing && editing.id !== object.id) stopEditing();
          editor.select(object.id);
          setCurrentPage(object.page);
        }}
        onStartEditing={() => startEditing(object)}
        onFinishEditing={stopEditing}
        onChange={(changes, record) => editor.patch(object.id, changes, record)}
        onInteractionStart={editor.checkpoint}
        onInteractionEnd={(changed) => { if (!changed) editor.dropCheckpoint(); }}
        onRemove={() => editor.remove(object.id)}
        onDuplicate={() => editor.duplicate(object.id)}
        onBringToFront={() => editor.bringToFront(object.id)}
      />
    );
  };

  const sidebar = (
    <PropertiesPanel
      file={file}
      objectCount={objects.length}
      mode={mode}
      selected={selected}
      styles={styles}
      signatures={signatures}
      onStyleChange={changeStyle}
      onDuplicate={() => selected && editor.duplicate(selected.id)}
      onRemove={() => selected && editor.remove(selected.id)}
      onInsertSignature={(s) => placeImage(s.src, s.width, s.height, 170)}
    />
  );

  const footer = (
    <>
      <Button icon="file" onClick={() => void openAnother()}>Abrir otro PDF</Button>
      <Button variant="primary" size="lg" icon="download" onClick={save}>Guardar PDF</Button>
    </>
  );

  return (
    <ToolLayout tool={tool} sidebar={sidebar} sidebarFooter={footer} flush>
      <div className="editor">
        <PageStrip file={file} currentPage={currentPage} onSelectPage={scrollToPage} />
        <div className="editor-stage-wrap">
          <EditorToolbar
            mode={mode}
            zoom={zoom}
            canUndo={editor.canUndo}
            onModeChange={switchMode}
            onAction={(action) => void onToolbarAction(action)}
            onZoomChange={changeZoom}
            onFitWidth={() => setZoomOverride(null)}
            onUndo={() => { if (!editor.undo()) toast('Nada que deshacer', 'info'); }}
          />
          <div ref={setScrollElement} className="editor-scroll">
            <div className="editor-pagestack">
              {pages.map(({ page, viewport }, pageIndex) => (
                <EditorPage
                  key={pageIndex}
                  pageIndex={pageIndex}
                  page={page}
                  viewport={viewport}
                  zoom={zoom}
                  mode={mode}
                  styles={styles}
                  objects={objects.filter((o) => o.page === pageIndex)}
                  scrollRoot={scrollElement}
                  renderObject={renderObject}
                  onVisibilityChange={onVisibilityChange}
                  onBackgroundPointerDown={(index) => {
                    stopEditing();
                    setCurrentPage(index);
                    if (mode === 'select') editor.select(null);
                  }}
                  onCreateText={createText}
                  onCreateObject={create}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </ToolLayout>
  );
}

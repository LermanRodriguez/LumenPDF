import { useEffect, useEffectEvent, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import type { PageViewport, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import { DEFAULT_BOX } from '../constants';
import type { NewEditorObject } from '../useEditorObjects';
import type { BoxMode, EditorObject, StyleDefaults, ToolMode } from '../types';

interface EditorPageProps {
  pageIndex: number;
  page: PDFPageProxy;
  /** Vista de la página a escala 1 (unidades de página). */
  viewport: PageViewport;
  zoom: number;
  mode: ToolMode;
  styles: StyleDefaults;
  objects: EditorObject[];
  /** Contenedor con scroll, para renderizar solo las páginas visibles. */
  scrollRoot: HTMLElement | null;
  renderObject: (object: EditorObject) => ReactNode;
  onVisibilityChange: (pageIndex: number, visible: boolean) => void;
  /** Clic en una zona vacía de la página. */
  onBackgroundPointerDown: (pageIndex: number) => void;
  onCreateText: (pageIndex: number, x: number, y: number) => void;
  onCreateObject: (object: NewEditorObject) => void;
}

type Point = { x: number; y: number };
type Draft = { kind: 'box'; from: Point; to: Point } | { kind: 'draw'; points: Point[] };

const BOX_MODES: ToolMode[] = ['highlight', 'rect', 'ellipse', 'line', 'whiteout'];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Una página del documento con su capa de objetos. */
export function EditorPage(props: EditorPageProps) {
  const { pageIndex, page, viewport, zoom, mode, styles, objects, scrollRoot } = props;
  const pageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  /* ---------- Visibilidad ---------- */
  const reportVisibility = useEffectEvent((isVisible: boolean) => props.onVisibilityChange(pageIndex, isVisible));
  useEffect(() => {
    const element = pageRef.current;
    if (!element || !scrollRoot) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      reportVisibility(entry.isIntersecting);
    }, { root: scrollRoot, rootMargin: '300px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageIndex, scrollRoot]);

  /* ---------- Render del PDF (solo si es visible) ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!visible) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const renderViewport = page.getViewport({ scale: zoom * pixelRatio });
    // Se dibuja en un canvas nuevo y se copia al terminar, para no ver la página en blanco
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.floor(renderViewport.width);
    offscreen.height = Math.floor(renderViewport.height);
    let task: RenderTask | null = page.render({ canvasContext: offscreen.getContext('2d')!, viewport: renderViewport });
    task.promise
      .then(() => {
        const target = canvasRef.current;
        if (!target) return;
        target.width = offscreen.width;
        target.height = offscreen.height;
        target.getContext('2d')!.drawImage(offscreen, 0, 0);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== 'RenderingCancelledException') console.error(error);
      })
      .finally(() => { task = null; });
    return () => task?.cancel();
  }, [page, visible, zoom]);

  /* ---------- Creación de objetos ---------- */
  const toPagePoint = (event: PointerEvent): Point => {
    const rect = layerRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / zoom, 0, viewport.width),
      y: clamp((event.clientY - rect.top) / zoom, 0, viewport.height),
    };
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    props.onBackgroundPointerDown(pageIndex);
    if (mode === 'select') return;
    event.preventDefault();
    const point = toPagePoint(event);
    if (mode === 'text') {
      props.onCreateText(pageIndex, point.x, point.y);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(mode === 'draw' ? { kind: 'draw', points: [point] } : { kind: 'box', from: point, to: point });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draft) return;
    const point = toPagePoint(event);
    setDraft(draft.kind === 'draw' ? { kind: 'draw', points: [...draft.points, point] } : { ...draft, to: point });
  };

  const onPointerUp = () => {
    if (!draft) return;
    setDraft(null);
    if (draft.kind === 'draw') createDrawing(draft.points);
    else if (BOX_MODES.includes(mode)) createBox(mode as BoxMode, draft.from, draft.to);
  };

  const createDrawing = (points: Point[]) => {
    if (points.length < 2) return;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - x);
    const h = Math.max(1, Math.max(...ys) - y);
    props.onCreateObject({
      kind: 'draw', page: pageIndex, x, y, w, h, ...styles.draw,
      strokes: [points.map((p): [number, number] => [(p.x - x) / w, (p.y - y) / h])],
    });
  };

  const createBox = (kind: BoxMode, from: Point, to: Point) => {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    let w = Math.abs(to.x - from.x);
    let h = Math.abs(to.y - from.y);
    const isClick = w < 4 && h < 4;
    if (isClick) [w, h] = DEFAULT_BOX[kind];
    const base = { page: pageIndex, x, y, w, h };
    switch (kind) {
      case 'line':
        props.onCreateObject({ kind, ...base, ...styles.line, flipped: !isClick && (to.x - from.x) * (to.y - from.y) < 0 });
        break;
      case 'rect':
      case 'ellipse':
        props.onCreateObject({ kind, ...base, ...styles[kind] });
        break;
      case 'highlight':
      case 'whiteout':
        props.onCreateObject({ kind, ...base, ...styles[kind] });
        break;
    }
  };

  const layerMode = mode === 'select' ? '' : mode === 'text' ? ' mode-text' : ' mode-shape';
  return (
    <div ref={pageRef} className="ed-page" style={{ width: viewport.width * zoom, height: viewport.height * zoom }}>
      <span className="ed-pagenum">Página {pageIndex + 1}</span>
      <canvas ref={canvasRef} className="ed-canvas" />
      <div
        ref={layerRef}
        className={`ed-layer${layerMode}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(null)}
      >
        {objects.map((object) => props.renderObject(object))}
        {draft && <DraftPreview draft={draft} zoom={zoom} styles={styles} />}
      </div>
    </div>
  );
}

/** Vista previa mientras se arrastra para crear algo. */
function DraftPreview({ draft, zoom, styles }: { draft: Draft; zoom: number; styles: StyleDefaults }) {
  if (draft.kind === 'draw') {
    return (
      <svg className="ed-draft-svg">
        <polyline
          fill="none"
          points={draft.points.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
          stroke={styles.draw.stroke}
          strokeOpacity={styles.draw.opacity}
          strokeWidth={styles.draw.strokeWidth * zoom}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const { from, to } = draft;
  return (
    <div
      className="ed-draft"
      style={{
        left: Math.min(from.x, to.x) * zoom,
        top: Math.min(from.y, to.y) * zoom,
        width: Math.abs(to.x - from.x) * zoom,
        height: Math.abs(to.y - from.y) * zoom,
      }}
    />
  );
}

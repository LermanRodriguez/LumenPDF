import { useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { useDialogs } from '@/app/providers/dialog-context';
import { useToast } from '@/app/providers/toast-context';
import { ToolLayout } from '@/components/layout/ToolLayout';
import { Dropzone } from '@/components/pdf/Dropzone';
import { ResultView } from '@/components/pdf/ResultView';
import { SortableGrid } from '@/components/pdf/SortableGrid';
import { WindowDrop } from '@/components/pdf/WindowDrop';
import { Button } from '@/components/ui/Button';
import { StatRow } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { getTool } from '@/features/catalog';
import { useHandoff } from '@/hooks/useHandoff';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePdfLoader } from '@/hooks/usePdfLoader';
import { useUndoableState } from '@/hooks/useUndoableState';
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning';
import { getPageSize } from '@/lib/pdf/render';
import { resultSize, type PdfFile, type ResultFile } from '@/lib/pdf/types';
import { pickFiles } from '@/lib/utils/files';
import { baseName, formatBytes, plural } from '@/lib/utils/format';
import { buildDocument } from './buildDocument';
import { LargePageDialog } from './components/LargePageDialog';
import { PageCard } from './components/PageCard';
import { A4, type PageItem } from './types';

const tool = getTool('organizar');
let nextUid = 0;

const normalizeRotation = (degrees: number) => ((degrees % 360) + 360) % 360;

export default function OrganizeTool() {
  const runTask = useBusyTask();
  const toast = useToast();
  const { open } = useDialogs();
  const { loadMany } = usePdfLoader();
  const pages = useUndoableState<PageItem[]>([]);
  const items = pages.state;
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastClicked = useRef<number | null>(null);
  const [thumbSize, setThumbSize] = useState(150);
  const [outputName, setOutputName] = useState('organizado');
  const [result, setResult] = useState<{ file: ResultFile; pageCount: number; extract: boolean } | null>(null);

  useUnsavedWarning(items.length > 0 && !result);

  /* ---------- Acciones ---------- */

  const addFiles = async (list: File[]) => {
    const loaded = await loadMany(list);
    if (!loaded.length) return;
    if (!files.length) setOutputName(`${baseName(loaded[0].name)}_organizado`);
    setFiles((current) => [...current, ...loaded]);
    const newItems: PageItem[] = loaded.flatMap((file) =>
      Array.from({ length: file.pageCount }, (_, index) => ({ uid: nextUid++, kind: 'page' as const, file, index, rotation: 0 })));
    pages.update((current) => [...current, ...newItems]);
  };
  useHandoff(addFiles);

  /** Las acciones de la barra se aplican a la selección, o a todo si no hay selección. */
  const targets = () => (selected.size ? items.filter((i) => selected.has(i.uid)) : items);

  const rotate = (list: PageItem[], degrees: number) => {
    const ids = new Set(list.map((i) => i.uid));
    pages.update((current) => current.map((i) => (ids.has(i.uid) ? { ...i, rotation: normalizeRotation(i.rotation + degrees) } : i)));
  };

  const remove = (list: PageItem[]) => {
    if (list.length >= items.length) {
      toast('No puedes eliminar todas las páginas', 'warn');
      return;
    }
    const ids = new Set(list.map((i) => i.uid));
    pages.update((current) => current.filter((i) => !ids.has(i.uid)));
    setSelected((current) => new Set([...current].filter((id) => !ids.has(id))));
  };

  const duplicate = (list: PageItem[]) => {
    const ids = new Set(list.map((i) => i.uid));
    pages.update((current) => current.flatMap((i) => (ids.has(i.uid) ? [i, { ...i, uid: nextUid++ }] : [i])));
  };

  const insertBlank = async () => {
    const selectedPositions = items.flatMap((item, i) => (selected.has(item.uid) ? [i] : []));
    const at = selectedPositions.length ? Math.max(...selectedPositions) + 1 : items.length;
    const reference = items[Math.max(0, at - 1)];
    let size = A4;
    if (reference?.kind === 'page') size = await getPageSize(reference.file, reference.index);
    else if (reference?.kind === 'blank') size = reference;
    pages.update((current) => {
      const copy = [...current];
      copy.splice(at, 0, { uid: nextUid++, kind: 'blank', width: size.width, height: size.height, rotation: 0 });
      return copy;
    });
    toast('Página en blanco insertada', 'ok');
  };

  const undo = () => {
    if (!pages.undo()) toast('Nada que deshacer', 'info');
    setSelected(new Set());
  };

  const selectWhere = (predicate: (index: number) => boolean) =>
    setSelected(new Set(items.filter((_, i) => predicate(i)).map((i) => i.uid)));

  /** Clic: selecciona. Ctrl/⌘: añade o quita. Shift: rango. */
  const onPageClick = (event: MouseEvent, item: PageItem) => {
    const index = items.indexOf(item);
    // Se lee ahora: el actualizador de estado puede ejecutarse después de cambiar la ref
    const anchor = lastClicked.current;
    const additive = event.ctrlKey || event.metaKey;
    const isRange = event.shiftKey;
    setSelected((current) => {
      const next = new Set(current);
      if (isRange && anchor !== null) {
        const [from, to] = [Math.min(anchor, index), Math.max(anchor, index)];
        for (let i = from; i <= to; i++) next.add(items[i].uid);
        return next;
      }
      if (additive || current.size) {
        if (next.has(item.uid)) next.delete(item.uid);
        else next.add(item.uid);
        return next;
      }
      return new Set([item.uid]);
    });
    lastClicked.current = index;
  };

  const openLarge = (item: PageItem) => {
    if (item.kind !== 'page') return;
    const position = items.indexOf(item) + 1;
    void open((close) => <LargePageDialog item={item} position={position} onClose={() => close()} />);
  };

  const save = (extract: boolean) => {
    const list = extract ? items.filter((i) => selected.has(i.uid)) : items;
    return runTask(extract ? 'Extrayendo páginas…' : 'Generando PDF…', async (progress) => {
      const bytes = await buildDocument(list, progress.setProgress);
      const name = `${outputName.trim().replace(/\.pdf$/i, '') || 'organizado'}${extract ? '_extracto' : ''}.pdf`;
      setResult({ file: { type: 'pdf', name, bytes }, pageCount: list.length, extract });
    });
  };

  /* ---------- Teclado ---------- */

  useKeyboardShortcuts((e, ctrl) => {
    if (!items.length || result) return;
    if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); selectWhere(() => true); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected.size) { e.preventDefault(); remove(targets()); }
    else if (e.key === 'Escape') setSelected(new Set());
  });

  /* ---------- Pantallas ---------- */

  if (result) {
    return (
      <ToolLayout tool={tool}>
        <ResultView
          toolId={tool.id}
          result={result.file}
          title={result.extract ? '¡Páginas extraídas!' : '¡PDF guardado!'}
          subtitle={<><b>{result.file.name}</b> · {plural(result.pageCount, 'página', 'páginas')} · {formatBytes(resultSize(result.file))}</>}
          onBack={() => setResult(null)}
        />
      </ToolLayout>
    );
  }

  if (!items.length) {
    return (
      <ToolLayout tool={tool}>
        <Dropzone title="Suelta un PDF para organizar sus páginas" subtitle="También puedes soltar varios: sus páginas se combinarán" icon="grid" color={tool.color} onFiles={addFiles} />
      </ToolLayout>
    );
  }

  const usedFiles = files.filter((f) => items.some((i) => i.kind === 'page' && i.file === f));

  const sidebar = (
    <>
      <SideBlock title="Documento">
        <StatRow label="Páginas" value={items.length} />
        {usedFiles.map((f) => (
          <StatRow
            key={f.id}
            label={<span className="file-name" style={{ fontWeight: 400 }}><span className="src-dot" style={{ background: f.color }} />{f.name}</span>}
            value={items.filter((i) => i.kind === 'page' && i.file === f).length}
          />
        ))}
      </SideBlock>
      <SideBlock title="Selección rápida">
        <div className="field-row">
          <Button size="sm" onClick={() => selectWhere(() => true)}>Todas</Button>
          <Button size="sm" onClick={() => selectWhere((i) => i % 2 === 0)}>Impares</Button>
          <Button size="sm" onClick={() => selectWhere((i) => i % 2 === 1)}>Pares</Button>
        </div>
        <div className="field-row" style={{ marginTop: 8 }}>
          <Button size="sm" onClick={() => setSelected(new Set())}>Ninguna</Button>
          <Button size="sm" icon="rotateCcw" onClick={() => pages.update((current) => [...current].reverse())}>Invertir orden</Button>
        </div>
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
      <Button icon="download" disabled={!selected.size} onClick={() => void save(true)}>
        Extraer {selected.size ? plural(selected.size, 'página', 'páginas') : 'selección'}
      </Button>
      <Button variant="primary" size="lg" icon="download" onClick={() => void save(false)}>Guardar PDF</Button>
    </>
  );

  return (
    <ToolLayout tool={tool} sidebar={sidebar} sidebarFooter={footer}>
      <WindowDrop label="Suelta para añadir páginas" active onFiles={addFiles} />
      <div className="toolbar">
        <Button icon="filePlus" onClick={async () => addFiles(await pickFiles())}>Añadir PDF</Button>
        <Button icon="fileBlank" onClick={() => void insertBlank()}>Página en blanco</Button>
        <div className="toolbar-group">
          <Button size="sm" variant="ghost" icon="rotateCcw" title="Girar a la izquierda" onClick={() => rotate(targets(), -90)} />
          <Button size="sm" variant="ghost" icon="rotateCw" title="Girar a la derecha" onClick={() => rotate(targets(), 90)} />
          <Button size="sm" variant="ghost" icon="copy" title="Duplicar" onClick={() => duplicate(targets())} />
          <Button
            size="sm" variant="danger" icon="trash" title="Eliminar" className="btn-ghost"
            onClick={() => (selected.size ? remove(targets()) : toast('Selecciona las páginas que quieres eliminar', 'info'))}
          />
        </div>
        <Button size="sm" icon="undo" title="Deshacer (Ctrl+Z)" disabled={!pages.canUndo} onClick={undo}>Deshacer</Button>
        <span className="spacer" />
        <div className="zoom-ctl">
          <Icon name="zoomOut" />
          <input type="range" min={90} max={300} value={thumbSize} aria-label="Tamaño de las miniaturas" onChange={(e) => setThumbSize(Number(e.target.value))} />
          <Icon name="zoomIn" />
        </div>
      </div>
      <div className="hint" style={{ margin: '-6px 0 14px' }}>
        {selected.size ? (
          <>
            <b>{plural(selected.size, 'página seleccionada', 'páginas seleccionadas')}</b> · las acciones de la barra se aplican a la selección ·{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); setSelected(new Set()); }}>Quitar selección</a>
          </>
        ) : (
          <><Icon name="handSelect" />Clic para seleccionar · Shift+clic para un rango · arrastra para reordenar · doble clic para ampliar</>
        )}
      </div>
      <SortableGrid
        className="page-grid"
        style={{ '--thumb': `${thumbSize}px` } as CSSProperties}
        items={items}
        getId={(i) => i.uid}
        onReorder={pages.update}
        renderItem={(item, index) => (
          <PageCard
            key={item.uid}
            item={item}
            position={index + 1}
            selected={selected.has(item.uid)}
            onClick={(e) => onPageClick(e, item)}
            onOpen={() => openLarge(item)}
            onRotate={(degrees) => rotate([item], degrees)}
            onRemove={() => remove([item])}
          />
        )}
      />
    </ToolLayout>
  );
}

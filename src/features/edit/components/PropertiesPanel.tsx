import { Button } from '@/components/ui/Button';
import { ColorSwatches, InfoBox, RangeField, Segmented, StatRow } from '@/components/ui/controls';
import { Field, SideBlock } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import type { PdfFile } from '@/lib/pdf/types';
import { FONTS, HIGHLIGHT_PALETTE, KIND_LABELS, MODE_HELP, PALETTE } from '../constants';
import type { EditorObject, FontKey, SignatureImage, StyleDefaults, ToolMode } from '../types';

/** Propiedades editables (unión de todas las de estilo). */
type StyleProps = Partial<{
  font: FontKey; size: number; color: string; bold: boolean; italic: boolean;
  stroke: string; fill: string; strokeWidth: number; opacity: number;
}>;

interface PropertiesPanelProps {
  file: PdfFile;
  objectCount: number;
  mode: ToolMode;
  /** Objeto seleccionado; si no hay, se editan los valores por defecto de la herramienta. */
  selected: EditorObject | null;
  styles: StyleDefaults;
  signatures: SignatureImage[];
  /** `record`: guardar en el historial (false mientras se mueve un deslizador). */
  onStyleChange: (changes: StyleProps, record: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onInsertSignature: (signature: SignatureImage) => void;
}

export function PropertiesPanel({ file, objectCount, mode, selected, styles, signatures, onStyleChange, onDuplicate, onRemove, onInsertSignature }: PropertiesPanelProps) {
  const kind = selected?.kind ?? mode;
  const values: StyleProps | undefined = selected ?? (kind in styles ? styles[kind as keyof StyleDefaults] : undefined);
  const set = (changes: StyleProps) => onStyleChange(changes, true);
  /** Los deslizadores actualizan en vivo; el historial se guarda al soltar (ver RangeField). */
  const slide = (changes: StyleProps) => onStyleChange(changes, false);

  return (
    <>
      <SideBlock>
        {!values ? (
          <div className="empty-props"><Icon name="cursor" />{MODE_HELP.select}</div>
        ) : (
          <>
            <div className="side-title">{selected ? 'Elemento seleccionado' : 'Herramienta'}: {KIND_LABELS[kind]}</div>
            {!selected && MODE_HELP[mode] && <p className="hint" style={{ margin: '-4px 0 16px' }}>{MODE_HELP[mode]}</p>}
            <StyleControls kind={kind} values={values} set={set} slide={slide} />
            {kind === 'text' && selected && <InfoBox>Doble clic sobre el texto (o Enter) para editarlo. Las esquinas cambian el tamaño de letra.</InfoBox>}
            {selected && (
              <div className="field-row" style={{ marginTop: 20 }}>
                <Button size="sm" icon="copy" onClick={onDuplicate}>Duplicar</Button>
                <Button size="sm" variant="danger" icon="trash" onClick={onRemove}>Eliminar</Button>
              </div>
            )}
          </>
        )}
      </SideBlock>

      {signatures.length > 0 && (
        <SideBlock title="Tus firmas (esta sesión)">
          <div className="signature-list">
            {signatures.map((signature, i) => (
              <Button key={i} onClick={() => onInsertSignature(signature)}><img src={signature.src} alt={`Firma ${i + 1}`} /></Button>
            ))}
          </div>
          <p className="hint">Haz clic para insertar de nuevo.</p>
        </SideBlock>
      )}

      <SideBlock title="Documento">
        <StatRow label="Archivo" value={file.name} />
        <StatRow label="Páginas" value={file.pageCount} />
        <StatRow label="Elementos añadidos" value={objectCount} />
      </SideBlock>
    </>
  );
}

interface StyleControlsProps {
  kind: string;
  values: StyleProps;
  set: (changes: StyleProps) => void;
  slide: (changes: StyleProps) => void;
}

/** Controles según el tipo de elemento. */
function StyleControls({ kind, values, set, slide }: StyleControlsProps) {
  const opacityPercent = Math.round((values.opacity ?? 1) * 100);
  const opacity = (min = 10) => (
    <RangeField label="Opacidad" min={min} max={100} value={opacityPercent} unit="%" onChange={(v) => slide({ opacity: v / 100 })} />
  );
  const strokeWidth = (
    <RangeField label="Grosor" min={0.5} max={20} step={0.5} value={values.strokeWidth ?? 1} unit=" pt" onChange={(v) => slide({ strokeWidth: v })} />
  );

  switch (kind) {
    case 'text':
      return (
        <>
          <Field label="Fuente">
            <Segmented
              value={values.font ?? 'helvetica'}
              onChange={(font) => set({ font })}
              options={(Object.keys(FONTS) as FontKey[]).map((key) => ({ value: key, label: <span style={{ fontFamily: FONTS[key].css }}>{FONTS[key].label}</span> }))}
            />
          </Field>
          <RangeField label="Tamaño" min={6} max={96} value={Math.round(values.size ?? 16)} unit=" pt" onChange={(size) => slide({ size })} />
          <Field label="Estilo">
            <div className="field-row">
              <Button size="sm" pressed={!!values.bold} onClick={() => set({ bold: !values.bold })}><b>N</b> Negrita</Button>
              <Button size="sm" pressed={!!values.italic} onClick={() => set({ italic: !values.italic })}><i>K</i> Cursiva</Button>
            </div>
          </Field>
          <Field label="Color"><ColorSwatches colors={PALETTE} value={values.color ?? ''} onChange={(color) => set({ color })} /></Field>
        </>
      );
    case 'rect':
    case 'ellipse':
      return (
        <>
          <Field label="Borde"><ColorSwatches allowNone colors={PALETTE} value={values.stroke ?? ''} onChange={(stroke) => set({ stroke })} /></Field>
          <Field label="Relleno"><ColorSwatches allowNone colors={PALETTE} value={values.fill ?? ''} onChange={(fill) => set({ fill })} /></Field>
          {strokeWidth}
          {opacity()}
        </>
      );
    case 'line':
    case 'draw':
      return (
        <>
          <Field label="Color"><ColorSwatches colors={PALETTE} value={values.stroke ?? ''} onChange={(stroke) => set({ stroke })} /></Field>
          {strokeWidth}
          {opacity()}
        </>
      );
    case 'highlight':
      return (
        <>
          <Field label="Color"><ColorSwatches colors={HIGHLIGHT_PALETTE} value={values.fill ?? ''} onChange={(fill) => set({ fill })} /></Field>
          <RangeField label="Intensidad" min={15} max={90} value={opacityPercent} unit="%" onChange={(v) => slide({ opacity: v / 100 })} />
        </>
      );
    case 'whiteout':
      return (
        <>
          <Field label="Color del recuadro"><ColorSwatches colors={PALETTE} value={values.fill ?? ''} onChange={(fill) => set({ fill })} /></Field>
          <InfoBox warn>Esto cubre la zona visualmente. El contenido original sigue en el archivo y podría copiarse. No lo uses para ocultar datos sensibles.</InfoBox>
        </>
      );
    case 'image':
      return opacity();
    default:
      return null;
  }
}

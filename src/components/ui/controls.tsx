/* Controles de formulario reutilizables. */
import { useState, type ReactNode } from 'react';
import { Field } from './Field';
import { Icon, type IconName } from './Icon';

/* ---------- Deslizador con valor visible ---------- */

interface RangeFieldProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function RangeField({ label, value, min, max, step = 1, unit = '', onChange }: RangeFieldProps) {
  return (
    <Field label={label}>
      {(id) => (
        <div className="range-row">
          <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
          <span className="range-val">{value}{unit}</span>
        </div>
      )}
    </Field>
  );
}

/* ---------- Selector segmentado ---------- */

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  description?: ReactNode;
}

interface SegmentedProps<T extends string | number> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string | number>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div className={className ? `segmented ${className}` : 'segmented'} role="group">
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.icon && <Icon name={option.icon} />}
          {option.label}
          {option.description && <span className="seg-sub">{option.description}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Tarjetas de opción ---------- */

interface OptionCardsProps<T extends string | number> {
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function OptionCards<T extends string | number>({ options, value, onChange, compact }: OptionCardsProps<T>) {
  return (
    <div className="option-cards" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={compact ? 'option-card compact' : 'option-card'}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <span className="oc-icon"><Icon name={option.icon} /></span>}
          <span>
            <strong>{option.label}</strong>
            {option.description && <span>{option.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Casilla ---------- */

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
}

export function Checkbox({ checked, onChange, children, hint }: CheckboxProps) {
  return (
    <>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {children}
      </label>
      {hint && <p className="hint check-hint">{hint}</p>}
    </>
  );
}

/* ---------- Muestras de color ---------- */

interface ColorSwatchesProps {
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
  /** Permite elegir "sin color" (valor ''). */
  allowNone?: boolean;
  /** Muestra un selector libre de color. */
  custom?: boolean;
}

export function ColorSwatches({ colors, value, onChange, allowNone, custom = true }: ColorSwatchesProps) {
  return (
    <div className="swatches">
      {allowNone && <button type="button" className="swatch-none" aria-pressed={!value} title="Sin color" onClick={() => onChange('')} />}
      {colors.map((color) => (
        <button key={color} type="button" aria-pressed={value === color} title={color} style={{ background: color }} onClick={() => onChange(color)} />
      ))}
      {custom && (
        <input type="color" title="Otro color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/* ---------- Contraseña con botón para mostrarla ---------- */

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}

export function PasswordInput({ id, value, onChange, placeholder, autoFocus, onEnter }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        id={id}
        className="input"
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
      />
      <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible(!visible)}>
        <Icon name={visible ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

/* ---------- Varios ---------- */

export function InfoBox({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return (
    <div className={warn ? 'info-box warn' : 'info-box'}>
      <Icon name={warn ? 'alert' : 'info'} />
      <div>{children}</div>
    </div>
  );
}

export function StatRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/* ---------- Selector de posición 3×3 ---------- */

export type GridPosition = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

const POSITION_NAMES: Record<GridPosition, string> = {
  tl: 'Arriba izquierda', tc: 'Arriba centro', tr: 'Arriba derecha',
  ml: 'Medio izquierda', mc: 'Centro', mr: 'Medio derecha',
  bl: 'Abajo izquierda', bc: 'Abajo centro', br: 'Abajo derecha',
};

interface PositionGridProps {
  value: GridPosition;
  onChange: (value: GridPosition) => void;
  allowed?: GridPosition[];
}

export function PositionGrid({ value, onChange, allowed }: PositionGridProps) {
  return (
    <div className="pos-grid" role="group">
      {(Object.keys(POSITION_NAMES) as GridPosition[]).map((position) => (
        <button
          key={position}
          type="button"
          title={POSITION_NAMES[position]}
          aria-label={POSITION_NAMES[position]}
          aria-pressed={position === value}
          disabled={allowed && !allowed.includes(position)}
          onClick={() => onChange(position)}
        />
      ))}
    </div>
  );
}

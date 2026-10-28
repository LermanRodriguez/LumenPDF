import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { TOOLBAR, type ToolbarAction } from '../constants';
import type { ToolMode } from '../types';

interface EditorToolbarProps {
  mode: ToolMode;
  zoom: number;
  canUndo: boolean;
  onModeChange: (mode: ToolMode) => void;
  onAction: (action: ToolbarAction) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  onUndo: () => void;
}

export function EditorToolbar({ mode, zoom, canUndo, onModeChange, onAction, onZoomChange, onFitWidth, onUndo }: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      {TOOLBAR.map((entry, i) => {
        if (entry.type === 'separator') return <span key={i} className="sep" />;
        const pressed = entry.type === 'mode' && entry.mode === mode;
        return (
          <button
            key={i}
            type="button"
            className="tool-btn"
            aria-pressed={pressed}
            title={entry.label}
            onClick={() => (entry.type === 'mode' ? onModeChange(entry.mode) : onAction(entry.action))}
          >
            <Icon name={entry.icon} />
            <span>{entry.label}</span>
          </button>
        );
      })}
      <span className="sep" />
      <div className="zoom-ctl">
        <Button size="sm" variant="ghost" iconOnly icon="zoomOut" title="Alejar" onClick={() => onZoomChange(zoom / 1.2)} />
        <span>{Math.round(zoom * 100)}%</span>
        <Button size="sm" variant="ghost" iconOnly icon="zoomIn" title="Acercar" onClick={() => onZoomChange(zoom * 1.2)} />
        <Button size="sm" variant="ghost" iconOnly icon="fit" title="Ajustar al ancho" onClick={onFitWidth} />
        <Button size="sm" variant="ghost" iconOnly icon="undo" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} />
      </div>
    </div>
  );
}

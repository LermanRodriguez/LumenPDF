import { useEffect, useState } from 'react';
import { useToast } from '@/app/providers/toast-context';
import { Button } from '@/components/ui/Button';
import { Checkbox, ColorSwatches, Segmented } from '@/components/ui/controls';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { pickFiles } from '@/lib/utils/files';
import { SIGNATURE_COLORS } from '../constants';
import type { SignatureImage } from '../types';
import { processSignatureImage, renderTypedSignature } from './canvasUtils';
import { useSignaturePad } from './useSignaturePad';

type Tab = 'draw' | 'type' | 'upload';

const HANDWRITING_FONTS = [
  { value: "'Segoe Script', 'Brush Script MT', cursive", label: 'Manuscrita' },
  { value: "'Lucida Handwriting', 'Segoe Script', cursive", label: 'Caligrafía' },
  { value: "'Brush Script MT', 'Segoe Script', cursive", label: 'Pincel' },
  { value: "'Ink Free', 'Segoe Print', cursive", label: 'Informal' },
];

interface SignatureDialogProps {
  onClose: (signature?: SignatureImage) => void;
}

/** Crear una firma dibujándola, escribiéndola o desde una imagen. */
export function SignatureDialog({ onClose }: SignatureDialogProps) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('draw');
  const [color, setColor] = useState(SIGNATURE_COLORS[0]);
  const [typedName, setTypedName] = useState('');
  const [typedFont, setTypedFont] = useState(HANDWRITING_FONTS[0].value);
  const [upload, setUpload] = useState<File | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [uploadPreview, setUploadPreview] = useState<SignatureImage | null>(null);
  const { canvasProps, clear: clearPad, toImage } = useSignaturePad(color);

  // Vista previa de la imagen subida (se recalcula al cambiar "quitar fondo")
  useEffect(() => {
    if (!upload) return;
    let cancelled = false;
    processSignatureImage(upload, removeBackground)
      .then((result) => { if (!cancelled) setUploadPreview(result); })
      .catch((error: unknown) => console.error(error));
    return () => { cancelled = true; };
  }, [upload, removeBackground]);

  const insert = () => {
    let signature: SignatureImage | null = null;
    if (tab === 'draw') signature = toImage();
    if (tab === 'type' && typedName.trim()) signature = renderTypedSignature(typedName, typedFont, color);
    if (tab === 'upload') signature = uploadPreview;
    if (!signature) {
      toast(tab === 'upload' ? 'Elige una imagen' : 'La firma está vacía', 'warn');
      return;
    }
    onClose(signature);
  };

  const chooseImage = async () => {
    const [file] = await pickFiles({ accept: 'image/*', multiple: false });
    if (file) setUpload(file);
  };

  return (
    <Modal
      wide
      title="Crear firma"
      subtitle="La firma se crea y se queda en tu dispositivo."
      onClose={() => onClose()}
      actions={<>
        <Button onClick={() => onClose()}>Cancelar</Button>
        <Button variant="primary" icon="check" onClick={insert}>Insertar firma</Button>
      </>}
    >
      <Segmented
        className="sig-tabs"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'draw', label: 'Dibujar', icon: 'pencil' },
          { value: 'type', label: 'Escribir', icon: 'text' },
          { value: 'upload', label: 'Subir imagen', icon: 'upload' },
        ]}
      />

      {/* El lienzo se mantiene montado (oculto) para no perder lo dibujado al cambiar de pestaña */}
      <div hidden={tab !== 'draw'}>
        <canvas className="sig-pad" {...canvasProps} />
        <div className="sig-pad-footer">
          <span className="hint">Firma con el ratón, el dedo o un lápiz.</span>
          <Button size="sm" icon="trash" onClick={clearPad}>Borrar</Button>
        </div>
      </div>

      {tab === 'type' && (
        <>
          <Field>
            <input className="input" placeholder="Escribe tu nombre" value={typedName} autoFocus onChange={(e) => setTypedName(e.target.value)} />
          </Field>
          <div className="sig-type-preview" style={{ fontFamily: typedFont, color: typedName ? color : '#bbb' }}>
            {typedName || 'Tu firma'}
          </div>
          <div style={{ marginTop: 10 }}>
            <Segmented
              value={typedFont}
              onChange={setTypedFont}
              options={HANDWRITING_FONTS.map((f) => ({ value: f.value, label: <span style={{ fontFamily: f.value, fontSize: 15 }}>{f.label}</span> }))}
            />
          </div>
        </>
      )}

      {tab === 'upload' && (
        <>
          <div className="sig-type-preview clickable" role="button" tabIndex={0} onClick={() => void chooseImage()}>
            {uploadPreview ? <img src={uploadPreview.src} alt="Firma" /> : 'Haz clic para elegir una imagen de tu firma'}
          </div>
          <div style={{ marginTop: 10 }}>
            <Checkbox checked={removeBackground} onChange={setRemoveBackground}>Quitar el fondo blanco</Checkbox>
          </div>
        </>
      )}

      {tab !== 'upload' && (
        <div style={{ marginTop: 12 }}>
          <ColorSwatches colors={SIGNATURE_COLORS} value={color} onChange={setColor} custom={false} />
        </div>
      )}
    </Modal>
  );
}

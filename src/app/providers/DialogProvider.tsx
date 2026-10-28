import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { InfoBox, PasswordInput } from '@/components/ui/controls';
import { Modal } from '@/components/ui/Modal';
import { DialogContext, type DialogApi, type OpenDialog } from './dialog-context';

interface DialogEntry {
  id: number;
  node: ReactNode;
}

let nextId = 0;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogEntry[]>([]);

  const open = useCallback<OpenDialog>((render) => new Promise((resolve) => {
    const id = nextId++;
    const close = (value?: unknown) => {
      setDialogs((list) => list.filter((d) => d.id !== id));
      resolve(value as never);
    };
    setDialogs((list) => [...list, { id, node: render(close) }]);
  }), []);

  const api = useMemo<DialogApi>(() => ({
    open,
    confirm: async (title, message, confirmLabel = 'Aceptar') => {
      const result = await open<boolean>((close) => (
        <Modal
          title={title}
          subtitle={message}
          onClose={() => close(false)}
          actions={<>
            <Button onClick={() => close(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => close(true)}>{confirmLabel}</Button>
          </>}
        />
      ));
      return result === true;
    },
    askPassword: (fileName, wrongAttempt) =>
      open<string>((close) => <PasswordDialog fileName={fileName} wrongAttempt={wrongAttempt} onClose={close} />),
  }), [open]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialogs.map((d) => <div key={d.id}>{d.node}</div>)}
    </DialogContext.Provider>
  );
}

interface PasswordDialogProps {
  fileName: string;
  wrongAttempt: boolean;
  onClose: (password?: string) => void;
}

function PasswordDialog({ fileName, wrongAttempt, onClose }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  return (
    <Modal
      title="PDF protegido"
      subtitle={<><b>{fileName}</b> requiere contraseña para abrirse.</>}
      onClose={() => onClose(undefined)}
      actions={<>
        <Button onClick={() => onClose(undefined)}>Cancelar</Button>
        <Button variant="primary" icon="unlock" onClick={() => onClose(password)}>Abrir</Button>
      </>}
    >
      {wrongAttempt && <InfoBox warn>Contraseña incorrecta. Inténtalo de nuevo.</InfoBox>}
      <Field label="Contraseña">
        {(id) => <PasswordInput id={id} value={password} onChange={setPassword} autoFocus onEnter={() => onClose(password)} />}
      </Field>
    </Modal>
  );
}

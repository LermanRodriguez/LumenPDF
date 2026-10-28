import { useCallback } from 'react';
import { useBusyTask } from '@/app/providers/busy-context';
import { useDialogs } from '@/app/providers/dialog-context';
import { useToast } from '@/app/providers/toast-context';
import { loadPdf } from '@/lib/pdf/loader';
import type { PdfFile } from '@/lib/pdf/types';
import { errorMessage } from '@/lib/utils/errors';
import { isPdfFile } from '@/lib/utils/files';
import { plural } from '@/lib/utils/format';

/**
 * Abre PDFs mostrando el progreso, pidiendo contraseña si hace falta
 * y avisando de los archivos que no se pudieron abrir.
 */
export function usePdfLoader() {
  const runTask = useBusyTask();
  const { askPassword } = useDialogs();
  const toast = useToast();

  const loadMany = useCallback(async (files: File[]): Promise<PdfFile[]> => {
    const pdfs = files.filter(isPdfFile);
    if (pdfs.length < files.length) toast(`Se ignoraron ${files.length - pdfs.length} archivo(s) que no son PDF`, 'warn');
    if (!pdfs.length) return [];

    const label = pdfs.length > 1 ? `Abriendo ${plural(pdfs.length, 'PDF', 'PDFs')}…` : 'Abriendo PDF…';
    const loaded = await runTask(label, async (progress) => {
      const result: PdfFile[] = [];
      for (const [i, file] of pdfs.entries()) {
        if (pdfs.length > 1) progress.setProgress(i, pdfs.length);
        try {
          const pdf = await loadPdf(file, askPassword);
          if (pdf) result.push(pdf);
        } catch (error) {
          console.error(error);
          toast(`${file.name}: ${errorMessage(error)}`, 'err', 6000);
        }
      }
      return result;
    });
    return loaded ?? [];
  }, [askPassword, runTask, toast]);

  /** Abre solo el primer PDF de la lista. */
  const loadOne = useCallback(async (files: File[]): Promise<PdfFile | null> => {
    if (files.length > 1) toast('Se usará solo el primer archivo', 'info');
    const [pdf] = await loadMany(files.slice(0, 1));
    return pdf ?? null;
  }, [loadMany, toast]);

  return { loadMany, loadOne };
}

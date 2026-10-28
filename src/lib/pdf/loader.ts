/* Apertura de PDFs: validación, detección de cifrado y descifrado en memoria. */
import { PDFDocument } from 'pdf-lib';
import { colorAt } from '@/lib/utils/colors';
import { InvalidPdfError, WrongPasswordError } from '@/lib/utils/errors';
import { readFileBytes } from '@/lib/utils/files';
import { decryptPdf } from './qpdf';
import type { PdfFile } from './types';

/** Pide la contraseña al usuario. Devuelve undefined si cancela. */
export type PasswordPrompt = (fileName: string, wrongAttempt: boolean) => Promise<string | undefined>;

let nextId = 0;

function looksLikePdf(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF');
}

const isEncryptedError = (error: unknown) => /encrypt/i.test(error instanceof Error ? error.message : String(error));

/**
 * Abre un PDF. Si está protegido, pide la contraseña y lo descifra.
 * Devuelve null si el usuario cancela.
 */
export async function loadPdf(file: File, requestPassword: PasswordPrompt): Promise<PdfFile | null> {
  let bytes = await readFileBytes(file);
  if (!looksLikePdf(bytes)) throw new InvalidPdfError(file.name);

  let doc: PDFDocument | null = null;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    if (!isEncryptedError(error)) throw error;
  }

  let password = '';
  const wasEncrypted = doc === null;
  if (wasEncrypted) {
    const decrypted = await decryptWithPrompt(bytes, file.name, requestPassword);
    if (!decrypted) return null;
    ({ bytes, password } = decrypted);
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  }

  const id = nextId++;
  return {
    id,
    name: file.name,
    bytes,
    pageCount: doc!.getPageCount(),
    color: colorAt(id),
    wasEncrypted,
    password,
  };
}

async function decryptWithPrompt(bytes: Uint8Array, fileName: string, requestPassword: PasswordPrompt) {
  // Muchos PDF solo tienen contraseña de propietario (restricciones): se abren sin contraseña.
  try {
    return { bytes: await decryptPdf(bytes, ''), password: '' };
  } catch (error) {
    if (!(error instanceof WrongPasswordError)) throw error;
  }
  let wrongAttempt = false;
  for (;;) {
    const password = await requestPassword(fileName, wrongAttempt);
    if (password === undefined) return null;
    try {
      return { bytes: await decryptPdf(bytes, password), password };
    } catch (error) {
      if (!(error instanceof WrongPasswordError)) throw error;
      wrongAttempt = true;
    }
  }
}

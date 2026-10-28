/*
 * qpdf compilado a WebAssembly: cifrado, descifrado y optimización.
 * Se carga bajo demanda (≈1.3 MB) solo cuando una herramienta lo necesita.
 */
import { WrongPasswordError } from '@/lib/utils/errors';
import { loadScript, vendorUrl } from '@/lib/utils/assets';

interface QpdfModule {
  callMain(args: string[]): number;
  FS: {
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
    unlink(path: string): void;
  };
}

type QpdfFactory = (options: { noInitialRun: boolean; locateFile: () => string }) => Promise<QpdfModule>;

/** qpdf terminó con error. */
export class QpdfError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super(`qpdf terminó con el código ${exitCode}`);
    this.name = 'QpdfError';
    this.exitCode = exitCode;
  }
}

let modulePromise: Promise<QpdfModule> | null = null;

function getQpdf(): Promise<QpdfModule> {
  modulePromise ??= (async () => {
    await loadScript(vendorUrl('qpdf/qpdf.js'));
    const factory = (window as unknown as { Module: QpdfFactory }).Module;
    return factory({ noInitialRun: true, locateFile: () => vendorUrl('qpdf/qpdf.wasm') });
  })().catch((error: unknown) => {
    modulePromise = null;
    throw error;
  });
  return modulePromise;
}

/** Ejecuta qpdf sobre un PDF en memoria y devuelve el PDF resultante. */
async function runQpdf(input: Uint8Array, buildArgs: (inPath: string, outPath: string) => string[]): Promise<Uint8Array> {
  const qpdf = await getQpdf();
  const id = Math.random().toString(36).slice(2);
  const inPath = `/in_${id}.pdf`;
  const outPath = `/out_${id}.pdf`;
  qpdf.FS.writeFile(inPath, input);

  let exitCode: number;
  try {
    exitCode = qpdf.callMain(buildArgs(inPath, outPath));
  } catch (error) {
    exitCode = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 2;
  }

  let output: Uint8Array | null = null;
  try { output = qpdf.FS.readFile(outPath); } catch { /* no hubo salida */ }
  for (const path of [inPath, outPath]) {
    try { qpdf.FS.unlink(path); } catch { /* ya no existe */ }
  }

  // Código 3 = terminó con advertencias, pero la salida es válida
  if ((exitCode === 0 || exitCode === 3) && output) return output;
  throw new QpdfError(exitCode);
}

/**
 * Descifra un PDF protegido. Solo se llama con PDFs cifrados, así que un fallo
 * equivale a contraseña incorrecta (esta compilación de qpdf no expone sus mensajes).
 */
export async function decryptPdf(bytes: Uint8Array, password = ''): Promise<Uint8Array> {
  try {
    return await runQpdf(bytes, (input, output) => [`--password=${password}`, '--decrypt', input, output]);
  } catch (error) {
    if (error instanceof QpdfError) throw new WrongPasswordError();
    throw error;
  }
}

export interface PdfPermissions {
  print: boolean;
  copy: boolean;
  modify: boolean;
  annotate: boolean;
  forms: boolean;
}

/** Cifra con AES-256. */
export function encryptPdf(bytes: Uint8Array, userPassword: string, ownerPassword: string, permissions: PdfPermissions): Promise<Uint8Array> {
  return runQpdf(bytes, (input, output) => [
    input, '--encrypt', userPassword, ownerPassword, '256',
    `--print=${permissions.print ? 'full' : 'none'}`,
    `--modify=${permissions.modify ? 'all' : 'none'}`,
    `--extract=${permissions.copy ? 'y' : 'n'}`,
    `--annotate=${permissions.annotate ? 'y' : 'n'}`,
    `--form=${permissions.forms ? 'y' : 'n'}`,
    '--', output,
  ]);
}

/** Reorganiza y recomprime sin pérdida de calidad. */
export function optimizePdf(bytes: Uint8Array): Promise<Uint8Array> {
  return runQpdf(bytes, (input, output) => [
    input, '--object-streams=generate', '--compress-streams=y', '--recompress-flate',
    '--compression-level=9', '--decode-level=generalized', '--remove-unreferenced-resources=yes', output,
  ]);
}

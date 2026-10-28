/** La contraseña indicada para abrir un PDF no es correcta. */
export class WrongPasswordError extends Error {
  constructor() {
    super('Contraseña incorrecta');
    this.name = 'WrongPasswordError';
  }
}

/** El archivo no es un PDF válido. */
export class InvalidPdfError extends Error {
  constructor(fileName: string) {
    super(`"${fileName}" no es un PDF válido.`);
    this.name = 'InvalidPdfError';
  }
}

/** Convierte cualquier error en un mensaje comprensible para el usuario. */
export function errorMessage(error: unknown): string {
  if (error instanceof InvalidPdfError) return error.message;
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/encrypt/i.test(message)) return 'El PDF está protegido con contraseña. Usa "Quitar contraseña" primero.';
  if (/Invalid PDF|No PDF header|parse/i.test(message)) return 'El archivo no parece un PDF válido o está dañado.';
  return `Ocurrió un error: ${message || 'desconocido'}`;
}

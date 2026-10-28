/** Un PDF abierto en la aplicación (ya descifrado si tenía contraseña). */
export interface PdfFile {
  readonly id: number;
  readonly name: string;
  /** Bytes del PDF listo para usar (descifrado). */
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  /** Color para identificar el archivo en la interfaz. */
  readonly color: string;
  readonly wasEncrypted: boolean;
  /** Contraseña usada para abrirlo ('' si no hizo falta). */
  readonly password: string;
}

/** Archivo generado por una herramienta, listo para descargar. */
export type ResultFile =
  | { type: 'pdf'; name: string; bytes: Uint8Array }
  | { type: 'file'; name: string; blob: Blob };

export function resultSize(file: ResultFile): number {
  return file.type === 'pdf' ? file.bytes.length : file.blob.size;
}

/** Tamaño de una página en puntos, tal como se ve (con su rotación aplicada). */
export interface PageSize {
  width: number;
  height: number;
  rotation: number;
}

/* Catálogo de herramientas: datos que se muestran en el inicio, las rutas y las cabeceras. */
import type { IconName } from '@/components/ui/Icon';

export type ToolId =
  | 'unir' | 'organizar' | 'dividir'
  | 'editar' | 'marca-agua' | 'numerar'
  | 'comprimir' | 'imagenes-a-pdf' | 'pdf-a-imagenes'
  | 'proteger' | 'desbloquear' | 'metadatos';

export type ToolSection = 'organizar' | 'editar' | 'convertir' | 'seguridad';

export interface ToolInfo {
  id: ToolId;
  name: string;
  description: string;
  icon: IconName;
  color: string;
  section: ToolSection;
}

export const SECTIONS: { id: ToolSection; title: string }[] = [
  { id: 'organizar', title: 'Organizar' },
  { id: 'editar', title: 'Editar y firmar' },
  { id: 'convertir', title: 'Convertir y optimizar' },
  { id: 'seguridad', title: 'Seguridad' },
];

export const TOOLS: ToolInfo[] = [
  { id: 'unir', name: 'Unir PDF', description: 'Combina varios PDFs en uno. Arrástralos para elegir el orden.', icon: 'merge', color: '#e5484d', section: 'organizar' },
  { id: 'organizar', name: 'Organizar páginas', description: 'Reordena, rota, elimina, duplica o inserta páginas visualmente.', icon: 'grid', color: '#3b6fe0', section: 'organizar' },
  { id: 'dividir', name: 'Dividir PDF', description: 'Separa un PDF en varios archivos marcando dónde cortar.', icon: 'scissors', color: '#d68a00', section: 'organizar' },
  { id: 'editar', name: 'Editar y firmar', description: 'Añade texto, firmas, imágenes, resaltados, formas y dibujos.', icon: 'edit', color: '#8e4ec6', section: 'editar' },
  { id: 'marca-agua', name: 'Marca de agua', description: 'Estampa un texto o un logo sobre las páginas, con vista previa.', icon: 'droplet', color: '#0894b3', section: 'editar' },
  { id: 'numerar', name: 'Numerar páginas', description: 'Añade números de página donde quieras, con el formato que elijas.', icon: 'hash', color: '#2f9e5b', section: 'editar' },
  { id: 'comprimir', name: 'Comprimir PDF', description: 'Reduce el tamaño del archivo. Compara el antes y el después.', icon: 'compress', color: '#f76b15', section: 'convertir' },
  { id: 'imagenes-a-pdf', name: 'Imágenes a PDF', description: 'Convierte fotos JPG, PNG o WEBP en un PDF. Ordénalas arrastrando.', icon: 'images', color: '#d6409f', section: 'convertir' },
  { id: 'pdf-a-imagenes', name: 'PDF a imágenes', description: 'Convierte páginas del PDF en imágenes JPG o PNG.', icon: 'fileImage', color: '#6e56cf', section: 'convertir' },
  { id: 'proteger', name: 'Proteger con contraseña', description: 'Cifra el PDF con AES-256 y controla qué se puede hacer con él.', icon: 'lock', color: '#e5484d', section: 'seguridad' },
  { id: 'desbloquear', name: 'Quitar contraseña', description: 'Elimina la contraseña y las restricciones de un PDF del que conoces la clave.', icon: 'unlock', color: '#12a594', section: 'seguridad' },
  { id: 'metadatos', name: 'Propiedades y metadatos', description: 'Consulta y edita título, autor y palabras clave, o bórralos para más privacidad.', icon: 'tag', color: '#3b6fe0', section: 'seguridad' },
];

export function getTool(id: ToolId): ToolInfo {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Herramienta desconocida: ${id}`);
  return tool;
}

/** Herramientas sugeridas en "Continuar con este PDF". */
export const FOLLOW_UP_TOOLS: ToolId[] = ['organizar', 'editar', 'comprimir', 'proteger', 'marca-agua', 'numerar'];

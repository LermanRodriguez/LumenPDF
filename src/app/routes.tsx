import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ToolId } from '@/features/catalog';

/*
 * Cada herramienta se carga solo cuando se abre (code splitting):
 * la página de inicio no descarga el código del editor, qpdf, etc.
 */
export const TOOL_COMPONENTS: Record<ToolId, LazyExoticComponent<ComponentType>> = {
  'unir': lazy(() => import('@/features/merge/MergeTool')),
  'organizar': lazy(() => import('@/features/organize/OrganizeTool')),
  'dividir': lazy(() => import('@/features/split/SplitTool')),
  'editar': lazy(() => import('@/features/edit/EditTool')),
  'marca-agua': lazy(() => import('@/features/watermark/WatermarkTool')),
  'numerar': lazy(() => import('@/features/page-numbers/PageNumbersTool')),
  'comprimir': lazy(() => import('@/features/compress/CompressTool')),
  'imagenes-a-pdf': lazy(() => import('@/features/images-to-pdf/ImagesToPdfTool')),
  'pdf-a-imagenes': lazy(() => import('@/features/pdf-to-images/PdfToImagesTool')),
  'proteger': lazy(() => import('@/features/protect/ProtectTool')),
  'desbloquear': lazy(() => import('@/features/unlock/UnlockTool')),
  'metadatos': lazy(() => import('@/features/metadata/MetadataTool')),
};

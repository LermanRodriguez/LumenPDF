import { PageThumbnail } from '@/components/pdf/PageThumbnail';
import type { PdfFile } from '@/lib/pdf/types';

interface PageStripProps {
  file: PdfFile;
  currentPage: number;
  onSelectPage: (pageIndex: number) => void;
}

/** Columna de miniaturas para saltar entre páginas. */
export function PageStrip({ file, currentPage, onSelectPage }: PageStripProps) {
  return (
    <div className="editor-pages">
      {Array.from({ length: file.pageCount }, (_, i) => (
        <div key={i} className={`page-item${i === currentPage ? ' selected' : ''}`} onClick={() => onSelectPage(i)}>
          <div className="thumb-wrap"><PageThumbnail file={file} pageIndex={i} width={130} /></div>
          <div className="page-label">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}

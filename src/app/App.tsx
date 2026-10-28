import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { TOOLS } from '@/features/catalog';
import { HomePage } from '@/features/home/HomePage';
import { BusyProvider } from './providers/BusyProvider';
import { DialogProvider } from './providers/DialogProvider';
import { ToastProvider } from './providers/ToastProvider';
import { TOOL_COMPONENTS } from './routes';

/*
 * HashRouter (#/unir, #/editar…) para que la aplicación funcione en cualquier
 * servidor estático sin configuración (GitHub Pages, carpeta local…).
 */
export function App() {
  return (
    <ToastProvider>
      <DialogProvider>
        <BusyProvider>
          <HashRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                {TOOLS.map(({ id }) => {
                  const Tool = TOOL_COMPONENTS[id];
                  // key por herramienta: al cambiar de herramienta se reinicia su estado
                  return <Route key={id} path={id} element={<Tool key={id} />} />;
                })}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </BusyProvider>
      </DialogProvider>
    </ToastProvider>
  );
}

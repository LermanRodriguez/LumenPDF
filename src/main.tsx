import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { applyTheme, getInitialTheme } from '@/hooks/useTheme';
import '@/styles/index.css';

// Aplica el tema antes del primer render para evitar un parpadeo
applyTheme(getInitialTheme());

// Evita que soltar un archivo fuera de una zona válida haga que el navegador lo abra
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

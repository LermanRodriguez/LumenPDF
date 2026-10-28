import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Política de seguridad del contenido: la aplicación nunca se conecta a servidores externos.
 * Solo se aplica en producción, porque el servidor de desarrollo de Vite necesita
 * scripts en línea y una conexión WebSocket para la recarga en caliente.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'lumenpdf-csp',
    apply: 'build',
    // Justo después de <meta charset>, que debe ser lo primero del <head>
    transformIndexHtml: (html) =>
      html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`),
  };
}

export default defineConfig({
  // Rutas relativas: funciona en cualquier carpeta o subruta (p. ej. GitHub Pages)
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    contentSecurityPolicy(),
    // Recursos que se cargan bajo demanda en tiempo de ejecución (copia plana, sin node_modules/…)
    viteStaticCopy({
      targets: [
        { src: 'node_modules/pdfjs-dist/cmaps/*', dest: 'vendor/pdfjs/cmaps', rename: { stripBase: true } },
        { src: 'node_modules/pdfjs-dist/standard_fonts/*', dest: 'vendor/pdfjs/standard_fonts', rename: { stripBase: true } },
        { src: 'node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.{js,wasm}', dest: 'vendor/qpdf', rename: { stripBase: true } },
      ],
    }),
  ],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});

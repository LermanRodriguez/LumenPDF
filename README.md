# LumenPDF

Editor de PDF que funciona **100 % en el dispositivo**: une, divide, organiza, edita, firma, comprime y protege PDFs sin subir nada a internet.

Construido con **React 19 + TypeScript + Vite**. Todo el procesamiento ocurre en el navegador. En producción, la página incluye una política de seguridad (CSP) que bloquea cualquier conexión externa.

## Puesta en marcha

Requisitos: [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Comprueba los tipos y genera la versión final en `dist/` |
| `npm run preview` | Sirve `dist/` para probar la versión final |
| `npm run typecheck` | Solo comprueba los tipos de TypeScript |
| `npm run lint` | Revisa el código con oxlint |

La carpeta `dist/` es un sitio estático: se puede publicar tal cual en GitHub Pages, Netlify o cualquier servidor (usa rutas relativas y `HashRouter`, así que no necesita configuración).

## Herramientas

| Sección | Herramienta | Carpeta |
|---|---|---|
| Organizar | Unir PDF | `features/merge` |
| | Organizar páginas | `features/organize` |
| | Dividir PDF | `features/split` |
| Editar y firmar | Editar y firmar | `features/edit` |
| | Marca de agua | `features/watermark` |
| | Numerar páginas | `features/page-numbers` |
| Convertir y optimizar | Comprimir PDF | `features/compress` |
| | Imágenes a PDF | `features/images-to-pdf` |
| | PDF a imágenes | `features/pdf-to-images` |
| Seguridad | Proteger con contraseña | `features/protect` |
| | Quitar contraseña | `features/unlock` |
| | Propiedades y metadatos | `features/metadata` |

## Estructura del código

```
src/
├── main.tsx                 Punto de entrada
├── app/
│   ├── App.tsx              Providers + rutas
│   ├── routes.tsx           Carga diferida de cada herramienta (code splitting)
│   └── providers/           Avisos (toast), indicador de progreso y diálogos
├── components/
│   ├── layout/              Cabecera, pie, estructura de herramienta, captura de errores
│   ├── pdf/                 Componentes PDF reutilizables (zona de soltar, miniaturas,
│   │                        vista previa, rejilla arrastrable, pantalla de resultado…)
│   └── ui/                  Controles genéricos (botones, campos, iconos, modal…)
├── features/
│   ├── catalog.ts           Catálogo de herramientas (nombre, icono, color, sección)
│   ├── home/                Pantalla de inicio
│   └── <herramienta>/
│       ├── XxxTool.tsx      Interfaz de la herramienta
│       └── xxx.ts           Lógica PDF pura (sin React), fácil de probar y reutilizar
├── hooks/                   Hooks compartidos (carga de PDFs, historial, atajos…)
├── lib/
│   ├── pdf/                 Núcleo PDF: carga y descifrado, pdf.js, pdf-lib, qpdf,
│   │                        renderizado, geometría, rangos, imágenes
│   └── utils/               Formato, archivos, colores, ZIP, errores
└── styles/                  CSS por área (tokens, layout, controles, editor…)
```

**Reglas de la arquitectura**

- La lógica PDF vive en archivos `.ts` sin React (`lib/pdf` y los `xxx.ts` de cada herramienta). Los componentes solo gestionan estado e interfaz.
- Cada herramienta es independiente y se carga solo cuando se abre.
- Los objetos del editor se guardan en *unidades de página* (puntos, origen arriba-izquierda, tal como se ve la página). `lib/pdf/geometry.ts` los convierte a coordenadas PDF, así que lo dibujado coincide con lo que se ve, incluso en páginas giradas.
- qpdf (≈1.3 MB) y los recursos de pdf.js se copian a `vendor/` al compilar y se cargan bajo demanda.

### Añadir una herramienta

1. Añádela a `TOOLS` en `src/features/catalog.ts` (y su id a `ToolId`).
2. Crea `src/features/mi-herramienta/MiHerramientaTool.tsx` con un `export default`.
3. Regístrala en `TOOL_COMPONENTS` de `src/app/routes.tsx`.

Las piezas habituales: `ToolLayout`, `Dropzone`, `usePdfLoader`, `useBusyTask` (progreso y errores), `ResultView` (descarga y "Continuar con…") y `useHandoff` (recibir PDFs de otra herramienta).

## Limitaciones conocidas

- El texto añadido usa las fuentes estándar del PDF (Helvetica, Times, Courier). Los acentos y la ñ funcionan; los emojis y otros alfabetos se reemplazan por `?`.
- "Tapar" cubre la zona visualmente, pero el texto original sigue dentro del archivo: no sirve para censurar datos sensibles.
- La compresión fuerte convierte las páginas en imágenes: el texto deja de poder seleccionarse.

## Librerías

pdf-lib (MIT), pdf.js (Apache-2.0), qpdf-wasm (ISC; qpdf es Apache-2.0), JSZip (MIT), dnd-kit (MIT), React Router (MIT).

---

Diseñado y desarrollado por **Lerman Maestre**.

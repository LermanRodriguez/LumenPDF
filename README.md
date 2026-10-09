# LumenPDF

Editor de PDFs que funciona **100 % en el dispositivo**. Ningún archivo se sube a internet: no hay servidor, todas las librerías están en `lib/` y la página bloquea cualquier conexión externa (Content-Security-Policy en `index.html`).

## Cómo abrirlo

- **Doble clic en `index.html`.** Funciona en Chrome, Edge y Firefox, también sin internet.
- Opcional, servidor local (un poco más rápido con PDFs grandes, porque pdf.js usa un *worker*):
  ```bash
  python -m http.server 8765 --bind 127.0.0.1
  ```
  y abrir http://127.0.0.1:8765

## Herramientas

| Sección | Herramienta | Qué hace |
|---|---|---|
| Organizar | Unir PDF | Tarjetas arrastrables, ordenar A→Z, duplicar, página en blanco para doble cara |
| | Organizar páginas | Miniaturas: reordenar, rotar, eliminar, duplicar, insertar en blanco, extraer, deshacer |
| | Dividir PDF | Tijeras entre páginas, cada N páginas, todas separadas o por rangos → ZIP |
| Editar | Editar y firmar | Texto, firma (dibujada, escrita o imagen), imágenes, resaltado, formas, línea, dibujo libre, tapar, ✓/✗, fecha |
| | Marca de agua | Texto o logo, centrada o en mosaico, con vista previa |
| | Numerar páginas | Posición 3×3, formatos, saltar portada, vista previa |
| Convertir | Comprimir | Sin pérdida (qpdf) o fuerte (páginas a JPG), con comparación de tamaño |
| | Imágenes a PDF | JPG/PNG/WEBP/GIF/BMP, rotar, A4/Carta/Oficio/ajustar, márgenes |
| | PDF a imágenes | JPG o PNG a 72/150/300 ppp → ZIP |
| Seguridad | Proteger | AES-256 con permisos (imprimir, copiar, modificar…) |
| | Quitar contraseña | Descifra con la contraseña o elimina restricciones |
| | Metadatos | Editar título/autor… o borrarlos todos |

Si abres un PDF protegido en cualquier herramienta, se pide la contraseña y se descifra en memoria. Al terminar, "Continuar con este PDF" pasa el resultado a otra herramienta.

## Estructura

```
index.html              página única
css/styles.css          estilos (tema claro/oscuro)
js/core/ui.js           avisos, modales, progreso, descargas
js/core/engine.js       carga/descifrado, miniaturas, qpdf, utilidades PDF
js/core/components.js   zona de soltar, pantalla final, vista previa, registro de herramientas
js/core/icons.js        iconos SVG
js/tools/*.js           una herramienta por archivo
js/app.js               navegación (#/herramienta) y pantalla de inicio
lib/                    pdf-lib, pdf.js, qpdf (WebAssembly), JSZip, SortableJS
```

### Añadir una herramienta

Crea `js/tools/mi-herramienta.js`, añade su `<script>` en `index.html` y registra:

```js
Tools.register({
    id: 'mi-herramienta', name: 'Mi herramienta', desc: '…',
    icon: 'file', color: '#3b6fe0', section: 'convertir',
    mount(ctx) {
        // ctx.body, ctx.side, ctx.footer: zonas de la pantalla
        // Engine.loadMany(files) carga PDFs (pide contraseña si hace falta)
        // Comp.finish(ctx, { out: { bytes, name } }) muestra el resultado y descarga
    },
});
```

## Limitaciones conocidas

- El texto añadido usa las fuentes estándar del PDF (Helvetica, Times, Courier): los acentos y la ñ funcionan, pero los emojis y otros alfabetos se reemplazan por `?`.
- "Tapar" cubre la zona visualmente, pero el texto original sigue dentro del archivo. No sirve para censurar datos sensibles.
- La compresión fuerte convierte las páginas en imágenes: el texto deja de poder seleccionarse.

## Licencias de las librerías

pdf-lib (MIT), pdf.js (Apache-2.0), qpdf-wasm (ISC; qpdf es Apache-2.0), JSZip (MIT), SortableJS (MIT).

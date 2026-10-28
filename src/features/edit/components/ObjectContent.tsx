import type { EditorObject } from '../types';

/** Margen invisible alrededor de las líneas para poder seleccionarlas aunque sean horizontales. */
export const LINE_HIT_PADDING = 6;

/** Dibujo de un objeto no textual (el texto lo pinta <TextBody>). */
export function ObjectContent({ object, zoom }: { object: Exclude<EditorObject, { kind: 'text' }>; zoom: number }) {
  const width = object.w * zoom;
  const height = object.h * zoom;

  switch (object.kind) {
    case 'image':
      return <img src={object.src} alt="" draggable={false} />;
    case 'highlight':
    case 'whiteout':
      return (
        <div style={{ width: '100%', height: '100%', background: object.fill, mixBlendMode: object.kind === 'highlight' ? 'multiply' : undefined }} />
      );
    case 'rect':
    case 'ellipse': {
      const stroke = object.stroke || 'none';
      const strokeWidth = object.stroke ? object.strokeWidth * zoom : 0;
      return (
        <svg>
          {object.kind === 'rect'
            ? <rect x={0} y={0} width={width} height={height} fill={object.fill || 'none'} stroke={stroke} strokeWidth={strokeWidth} />
            : <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={object.fill || 'none'} stroke={stroke} strokeWidth={strokeWidth} />}
        </svg>
      );
    }
    case 'line': {
      const p = LINE_HIT_PADDING;
      const [from, to] = object.flipped ? [[0, height], [width, 0]] : [[0, 0], [width, height]];
      return (
        <svg>
          <line x1={from[0] + p} y1={from[1] + p} x2={to[0] + p} y2={to[1] + p} stroke={object.stroke} strokeWidth={object.strokeWidth * zoom} strokeLinecap="round" />
        </svg>
      );
    }
    case 'draw':
      return (
        <svg>
          {object.strokes.map((stroke, i) => (
            <polyline
              key={i}
              fill="none"
              points={stroke.map(([px, py]) => `${px * width},${py * height}`).join(' ')}
              stroke={object.stroke}
              strokeWidth={object.strokeWidth * zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      );
  }
}

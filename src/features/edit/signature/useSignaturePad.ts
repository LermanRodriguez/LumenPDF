import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { SignatureImage } from '../types';
import { trimCanvas } from './canvasUtils';

interface Stroke {
  color: string;
  /** [x, y, presión] */
  points: Array<[number, number, number]>;
}

/**
 * Lienzo para firmar con ratón, dedo o lápiz.
 * El grosor del trazo varía con la presión cuando el dispositivo la detecta.
 */
export function useSignaturePad(color: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const drawSegment = useCallback((stroke: Stroke, from: number) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    if (stroke.points.length === 1) {
      const [x, y] = stroke.points[0];
      context.beginPath();
      context.arc(x, y, 1.6, 0, Math.PI * 2);
      context.fill();
      return;
    }
    for (let i = Math.max(1, from); i < stroke.points.length; i++) {
      const [x0, y0] = stroke.points[i - 1];
      const [x1, y1, pressure] = stroke.points[i];
      context.lineWidth = 1.6 + pressure * 2.4;
      context.beginPath();
      context.moveTo(x0, y0);
      context.lineTo(x1, y1);
      context.stroke();
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    strokes.current.forEach((stroke) => drawSegment(stroke, 1));
  }, [drawSegment]);

  // Prepara el lienzo a la resolución de la pantalla
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const context = canvas.getContext('2d')!;
    context.scale(scale, scale);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    redraw();
  }, [redraw]);

  // Cambiar el color recolorea toda la firma
  useEffect(() => {
    strokes.current.forEach((stroke) => { stroke.color = color; });
    redraw();
  }, [color, redraw]);

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>): [number, number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top, event.pressure || 0.5];
  };

  /** Propiedades para el <canvas> de la firma. */
  const canvasProps = {
    ref: canvasRef,
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      current.current = { color, points: [pointFrom(event)] };
      strokes.current.push(current.current);
      drawSegment(current.current, 0);
      setIsEmpty(false);
    },
    onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => {
      const stroke = current.current;
      if (!stroke) return;
      stroke.points.push(pointFrom(event));
      drawSegment(stroke, stroke.points.length - 1);
    },
    onPointerUp: () => { current.current = null; },
    onPointerCancel: () => { current.current = null; },
  };

  const clear = () => {
    strokes.current = [];
    setIsEmpty(true);
    redraw();
  };

  /** La firma dibujada como imagen recortada (null si está vacía). */
  const toImage = (): SignatureImage | null => (canvasRef.current && strokes.current.length ? trimCanvas(canvasRef.current) : null);

  return { canvasProps, clear, isEmpty, toImage };
}

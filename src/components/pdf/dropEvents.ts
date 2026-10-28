/*
 * Coordinación entre la zona de soltar central y la de toda la ventana:
 * si la zona central ya recibió el archivo, la ventana no debe procesarlo otra vez.
 */
const handledDrops = new WeakSet<Event>();

export function markDropHandled(event: Event): void {
  handledDrops.add(event);
}

export function isDropHandled(event: Event): boolean {
  return handledDrops.has(event);
}

export function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

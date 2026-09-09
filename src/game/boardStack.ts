/** Board stacking. CSS: z-index = (row+1)*10 + --z-layer. Do not rely on DOM order. */

export const Z_LAYER = {
  ice: 0,
  glow: 2,
  wall: 2,
  door: 3,
  star: 4,
  actor: 5,
} as const;

export type ZLayer = (typeof Z_LAYER)[keyof typeof Z_LAYER];

export function placeBoardItem(
  el: HTMLElement,
  x: number,
  y: number,
  row: number,
  layer: ZLayer,
): void {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.setProperty('--row', String(row));
  el.style.setProperty('--z-layer', String(layer));
}

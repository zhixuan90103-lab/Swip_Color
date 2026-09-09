/**
 * Board stacking — one formula, applied in JS (`placeBoardItem` sets `z-index`).
 * Do not also set z-index on `.ice-piece` / `.ice-cell` in CSS (those rules
 * fight inline values with !important and hide occupancy wash).
 *
 * Floor (ignore row so ice/add never cover the character):
 *   0 ice tile
 *   1 occupancy add — same size as the tile, sibling above ice
 *
 * Actors (larger row = further south = in front):
 *   z = (row + 1) * 10 + layer
 *   2 glow, wall
 *   3 door
 *   4 star
 *   5 box
 *   9 you
 */

export const Z_ROW = 10;

export const Z_LAYER = {
  ice: 0,
  add: 1,
  glow: 2,
  wall: 2,
  door: 3,
  star: 4,
  box: 5,
  you: 9,
} as const;

export type ZLayer = (typeof Z_LAYER)[keyof typeof Z_LAYER];

export function stackZ(row: number, layer: number): number {
  if (layer <= Z_LAYER.add) return layer;
  return (row + 1) * Z_ROW + layer;
}

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
  el.style.zIndex = String(stackZ(row, layer));
}

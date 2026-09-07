export type Dir = 'up' | 'down' | 'left' | 'right';

export type Cell = { r: number; c: number };

export type LevelDef = {
  id: number;
  title: string;
  hint: string;
  make: () => IceState;
};

export type IceState = {
  rows: number;
  cols: number;
  player: Cell;
  boxes: Cell[];
  stars: Cell[];
  door: Cell;
  /** 铺出来的冰面（含门）。矩形里默认都铺；不要挖空。 */
  open: Cell[];
  /** 仅必须挡路时才放的墙砖。 */
  walls: Cell[];
  collected: number;
  won: boolean;
};

export type SlideKind = 'slide' | 'brake' | 'push' | 'stuck';

export type SlideResult = {
  state: IceState;
  kind: SlideKind;
  playerPath: Cell[];
  boxPath: Cell[] | null;
  pushedBox: number | null;
  starsPicked: Cell[];
};

export const DIR_DELTA: Record<Dir, Cell> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

export function cellKey(c: Cell): string {
  return `${c.r},${c.c}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.r === b.r && a.c === b.c;
}

export function ratingStars(state: IceState): number {
  if (!state.won) return 0;
  return 1 + state.collected;
}

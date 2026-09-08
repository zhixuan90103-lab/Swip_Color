/**
 * Board layout — one knob, one job.
 *
 * The 9-slice tray size is independent of the ice grid.
 *
 *   宽 boardW   outer width of the tray (border-box, includes rim)
 *   高 boardH   outer height of the tray
 *   框距 inset  padding from the inner well to the slot grid (may be negative)
 *   缝隙 gap    space between slots
 *   格子 cell   sprite size of ice / pieces, centered in each slot
 *
 * Square slots fit the padded well:
 *   wellW/H  = boardW/H - 2 * rim
 *   padded   = well - 2 * inset
 *   slot     = min of the row/col fit
 * The slot grid is centered in the padded well.
 * Changing `cell` must not change board, slot, or origin.
 */

export const BOARD_RIM = 44;

export type BoardTune = {
  boardW: number;
  boardH: number;
  cell: number;
  gap: number;
  inset: number;
  cellOpacity: number;
  shadowW: number;
  shadowH: number;
};

export const TUNE_DEFAULT: BoardTune = {
  boardW: 360,
  boardH: 366,
  cell: 60,
  gap: 2,
  inset: -20,
  cellOpacity: 60,
  shadowW: 356,
  shadowH: 358,
};

export const TUNE_RANGE = {
  boardW: { min: 200, max: 520 },
  boardH: { min: 200, max: 560 },
  cell: { min: 28, max: 80 },
  gap: { min: 0, max: 32 },
  inset: { min: -48, max: 64 },
  cellOpacity: { min: 0, max: 100 },
  shadowW: { min: 160, max: 520 },
  shadowH: { min: 160, max: 560 },
} as const;

export type BoardLayout = {
  boardW: number;
  boardH: number;
  rim: number;
  inset: number;
  gap: number;
  cell: number;
  slot: number;
  gridW: number;
  gridH: number;
  originX: number;
  originY: number;
  spritePad: number;
};

export function layoutBoard(
  tune: BoardTune,
  rows: number,
  cols: number,
): BoardLayout {
  const rim = BOARD_RIM;
  const wellW = tune.boardW - rim * 2;
  const wellH = tune.boardH - rim * 2;
  const paddedW = wellW - tune.inset * 2;
  const paddedH = wellH - tune.inset * 2;
  const slot = slotSize(paddedW, paddedH, tune.gap, rows, cols);
  const gridW = cols * slot + Math.max(0, cols - 1) * tune.gap;
  const gridH = rows * slot + Math.max(0, rows - 1) * tune.gap;
  const originX = tune.inset + (paddedW - gridW) / 2;
  const originY = tune.inset + (paddedH - gridH) / 2;
  return {
    boardW: tune.boardW,
    boardH: tune.boardH,
    rim,
    inset: tune.inset,
    gap: tune.gap,
    cell: tune.cell,
    slot,
    gridW,
    gridH,
    originX,
    originY,
    spritePad: (slot - tune.cell) / 2,
  };
}

/** Slot center. Sprites sit on this point and scale with translate(-50%, -50%). */
export function tokenPos(
  laid: BoardLayout,
  c: { r: number; c: number },
): { x: number; y: number } {
  const stride = laid.slot + laid.gap;
  return {
    x: c.c * stride + laid.slot / 2,
    y: c.r * stride + laid.slot / 2,
  };
}

function slotSize(
  paddedW: number,
  paddedH: number,
  gap: number,
  rows: number,
  cols: number,
): number {
  const fit = (span: number, n: number) => {
    if (n <= 0) return 1;
    return (span - Math.max(0, n - 1) * gap) / n;
  };
  return Math.max(1, Math.min(fit(paddedW, cols), fit(paddedH, rows)));
}

/**
 * Board layout — one knob, one job.
 *
 * Tune boardW/H/gap/inset describes the **level-1 (5×5) template**.
 * Other sizes keep that same slot, gap, and inset, and grow the tray so
 * tiles don't shrink on 5×6 / 6×6 boards.
 *
 *   宽/高     level-1 tray outer size
 *   框距 inset  padding from inner well to the slot grid (may be negative)
 *   缝隙 gap    space between slots
 *   格子 cell   sprite size, centered in each slot (does not change slot)
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
  boxSize: number;
  youSize: number;
  wallSize: number;
  boxX: number;
  boxY: number;
  youX: number;
  youY: number;
  youShadow: number;
  youShadowX: number;
  youShadowY: number;
  wallX: number;
  wallY: number;
  starSize: number;
  starX: number;
  starY: number;
  glowSize: number;
  glowX: number;
  glowY: number;
  glowOpacity: number;
  doorSize: number;
};

export const TUNE_DEFAULT: BoardTune = {
  boardW: 360,
  boardH: 366,
  cell: 60,
  gap: 2,
  inset: -20,
  cellOpacity: 25,
  shadowW: 356,
  shadowH: 358,
  boxSize: 66,
  youSize: 66,
  wallSize: 66,
  boxX: 1,
  boxY: -2,
  youX: 0,
  youY: -10,
  youShadow: 50,
  youShadowX: 0,
  youShadowY: 7,
  wallX: 0,
  wallY: 0,
  starSize: 70,
  starX: 0,
  starY: -15,
  glowSize: 60,
  glowX: 0,
  glowY: 5,
  glowOpacity: 60,
  doorSize: 70,
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
  boxSize: { min: 20, max: 120 },
  youSize: { min: 20, max: 120 },
  wallSize: { min: 20, max: 120 },
  boxX: { min: -24, max: 24 },
  boxY: { min: -24, max: 24 },
  youX: { min: -24, max: 24 },
  youY: { min: -24, max: 24 },
  youShadow: { min: 16, max: 120 },
  youShadowX: { min: -32, max: 32 },
  youShadowY: { min: -32, max: 32 },
  wallX: { min: -24, max: 24 },
  wallY: { min: -24, max: 24 },
  starSize: { min: 20, max: 120 },
  starX: { min: -24, max: 24 },
  starY: { min: -24, max: 24 },
  glowSize: { min: 8, max: 80 },
  glowX: { min: -24, max: 24 },
  glowY: { min: -24, max: 24 },
  glowOpacity: { min: 0, max: 100 },
  doorSize: { min: 20, max: 120 },
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

const TEMPLATE_ROWS = 5;
const TEMPLATE_COLS = 5;

export function layoutBoard(
  tune: BoardTune,
  rows: number,
  cols: number,
): BoardLayout {
  const rim = BOARD_RIM;
  const gap = tune.gap;
  const inset = tune.inset;
  const chrome = 2 * (rim + inset);
  const slot = templateSlot(tune);
  const refGridW = TEMPLATE_COLS * slot + (TEMPLATE_COLS - 1) * gap;
  const refGridH = TEMPLATE_ROWS * slot + (TEMPLATE_ROWS - 1) * gap;
  const extraW = tune.boardW - (refGridW + chrome);
  const extraH = tune.boardH - (refGridH + chrome);
  const gridW = cols * slot + Math.max(0, cols - 1) * gap;
  const gridH = rows * slot + Math.max(0, rows - 1) * gap;
  const boardW = gridW + chrome + extraW;
  const boardH = gridH + chrome + extraH;
  const paddedW = boardW - chrome;
  const paddedH = boardH - chrome;
  const originX = inset + (paddedW - gridW) / 2;
  const originY = inset + (paddedH - gridH) / 2;
  return {
    boardW,
    boardH,
    rim,
    inset,
    gap,
    cell: tune.cell,
    slot,
    gridW,
    gridH,
    originX,
    originY,
    spritePad: (slot - tune.cell) / 2,
  };
}

function templateSlot(tune: BoardTune): number {
  const wellW = tune.boardW - BOARD_RIM * 2;
  const wellH = tune.boardH - BOARD_RIM * 2;
  const paddedW = wellW - tune.inset * 2;
  const paddedH = wellH - tune.inset * 2;
  return slotSize(paddedW, paddedH, tune.gap, TEMPLATE_ROWS, TEMPLATE_COLS);
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

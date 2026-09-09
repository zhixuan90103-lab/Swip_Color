import type { BoardLayout } from './boardLayout';
import type { Cell } from './iceTypes';

/** Occupancy wash: current cell 0.5, others 0. Same ice-a/ice-b art as the tile. */
export const CELL_ADD_OP = 0.5;
export const CELL_ADD_FADE_MS = 450;

export function cellAddFadeMs(stepMs: number, baseStepMs: number): number {
  if (baseStepMs <= 0) return CELL_ADD_FADE_MS;
  return CELL_ADD_FADE_MS * (stepMs / baseStepMs);
}

export type CellAdd = {
  reset: () => void;
  setStepMs: (ms: number) => void;
  beginStep: (from: Cell, to: Cell, now: number, ms: number) => void;
  endTrack: () => void;
  hold: (c: Cell) => void;
  tick: () => void;
};

export function createCellAdd(opts: {
  getBoard: () => HTMLElement;
  getLaid: () => BoardLayout;
  getYou: () => HTMLElement | null;
  getBaseStepMs: () => number;
  prefersReduce: () => boolean;
}): CellAdd {
  let youCellKey = '';
  let stepMs = opts.getBaseStepMs();
  let slideTrack: { from: Cell; to: Cell; t0: number; ms: number } | null = null;

  function addEl(c: Cell): HTMLElement | null {
    return opts.getBoard().querySelector(`[data-cell="${c.r}-${c.c}"]:not(.is-pooled) .ice-cell-add`);
  }

  function light(c: Cell, on: boolean): void {
    const add = addEl(c);
    if (!add) return;
    if (opts.prefersReduce()) {
      add.style.transition = 'none';
      add.style.opacity = on ? String(CELL_ADD_OP) : '0';
      return;
    }
    // Enter must snap: a 50ms ice step is shorter than the old 120ms fade-in,
    // so mid-path cells never reached 0.5. Leave still fades for the trail.
    if (on) {
      add.style.transition = 'none';
      add.style.opacity = String(CELL_ADD_OP);
      return;
    }
    const ms = cellAddFadeMs(stepMs, opts.getBaseStepMs());
    add.style.transition = `opacity ${ms}ms ease-out`;
    add.style.opacity = '0';
  }

  function hold(c: Cell): void {
    const key = `${c.r}-${c.c}`;
    if (key === youCellKey) return;
    if (youCellKey) {
      const prev = youCellKey.split('-').map(Number);
      light({ r: prev[0]!, c: prev[1]! }, false);
    }
    youCellKey = key;
    light(c, true);
  }

  return {
    reset() {
      youCellKey = '';
      slideTrack = null;
      opts.getBoard().querySelectorAll('.ice-cell-add').forEach((el) => {
        const n = el as HTMLElement;
        n.style.transition = 'none';
        n.style.opacity = '0';
      });
    },
    setStepMs(ms) {
      stepMs = ms;
    },
    beginStep(from, to, now, ms) {
      stepMs = ms;
      slideTrack = { from, to, t0: now, ms };
    },
    endTrack() {
      slideTrack = null;
    },
    hold,
    tick() {
      if (!slideTrack) return;
      const u = Math.min(1, Math.max(0, (performance.now() - slideTrack.t0) / slideTrack.ms));
      hold(u < 0.5 ? slideTrack.from : slideTrack.to);
    },
  };
}

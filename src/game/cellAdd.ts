import { tokenPos, type BoardLayout } from './boardLayout';
import type { Cell } from './iceTypes';

export const CELL_ADD_OP = 0.4;
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
    return opts.getBoard().querySelector(`[data-cell="${c.r}-${c.c}"] .ice-cell-add`);
  }

  function light(c: Cell, fade: boolean): void {
    const add = addEl(c);
    if (!add) return;
    add.style.transition = 'none';
    add.style.opacity = String(CELL_ADD_OP);
    void add.offsetWidth;
    if (opts.prefersReduce()) {
      add.style.opacity = fade ? '0' : String(CELL_ADD_OP);
      return;
    }
    if (fade) {
      add.style.transition = `opacity ${cellAddFadeMs(stepMs, opts.getBaseStepMs())}ms ease-out`;
      add.style.opacity = '0';
    }
  }

  function hold(c: Cell): void {
    const key = `${c.r}-${c.c}`;
    if (key === youCellKey) return;
    if (youCellKey) {
      const prev = youCellKey.split('-').map(Number);
      light({ r: prev[0]!, c: prev[1]! }, true);
    }
    youCellKey = key;
    light(c, false);
  }

  return {
    reset() {
      youCellKey = '';
      slideTrack = null;
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
      const laid = opts.getLaid();
      const board = opts.getBoard();
      let x = 0;
      let y = 0;
      if (slideTrack) {
        const u = Math.min(1, Math.max(0, (performance.now() - slideTrack.t0) / slideTrack.ms));
        const a = tokenPos(laid, slideTrack.from);
        const b = tokenPos(laid, slideTrack.to);
        x = a.x + (b.x - a.x) * u;
        y = a.y + (b.y - a.y) * u;
      } else {
        const youEl = opts.getYou();
        if (!youEl) return;
        x = parseFloat(getComputedStyle(youEl).left);
        y = parseFloat(getComputedStyle(youEl).top);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      }
      let best: Cell | null = null;
      let bestD = Infinity;
      board.querySelectorAll('.ice-cell[data-cell]').forEach((el) => {
        const id = el.getAttribute('data-cell');
        if (!id) return;
        const parts = id.split('-');
        const r = Number(parts[0]);
        const c = Number(parts[1]);
        if (!Number.isFinite(r) || !Number.isFinite(c)) return;
        const p = tokenPos(laid, { r, c });
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (d < bestD) {
          bestD = d;
          best = { r, c };
        }
      });
      if (best) hold(best);
    },
  };
}

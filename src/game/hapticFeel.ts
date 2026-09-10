import { hitAmpForCells, YOU_HIT_AMP_FULL_CELLS } from './youMotion';
import { DIR_DELTA, cellKey, type Cell, type Dir, type IceState, type SlideKind } from './iceTypes';

/** Numbers live here and in docs/HAPTICS-FEEL.md. */

export type HapticSurface = 'stone' | 'wood-crate' | 'wood-frame' | 'none';

export const HAPTIC_INTENSITY_BASE = 0.28;
export const HAPTIC_INTENSITY_SPAN = 0.5;
export const HAPTIC_INTENSITY_MIN = 0.22;
export const HAPTIC_INTENSITY_MAX = 0.82;
export const HAPTIC_CRATE_ON_CRATE = 0.9;

export const HAPTIC_SHARPNESS = {
  body: 0.25,
  nudge: 0.22,
  stone: 0.8,
  woodCrate: 0.45,
  woodFrame: 0.5,
  star: 0.45,
} as const;

export const HAPTIC_NUDGE_INTENSITY = 0.28;
export const HAPTIC_STAR_INTENSITY = 0.22;

export const HAPTIC_JELLY_MS = 60;
export const HAPTIC_JELLY_INTENSITY = 0.13;
export const HAPTIC_JELLY_SHARPNESS = 0.12;

export const HAPTIC_COOLDOWN = {
  land: 80,
  nudge: 60,
  star: 90,
  clear: 400,
} as const;

export type LandFeel = {
  intensity: number;
  sharpness: number;
  jelly: boolean;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function landIntensity(amp: number): number {
  return clamp(HAPTIC_INTENSITY_BASE + HAPTIC_INTENSITY_SPAN * amp, HAPTIC_INTENSITY_MIN, HAPTIC_INTENSITY_MAX);
}

export function sharpnessForSurface(surface: HapticSurface): number {
  switch (surface) {
    case 'stone':
      return HAPTIC_SHARPNESS.stone;
    case 'wood-crate':
      return HAPTIC_SHARPNESS.woodCrate;
    case 'wood-frame':
      return HAPTIC_SHARPNESS.woodFrame;
    default:
      return HAPTIC_SHARPNESS.nudge;
  }
}

export function stopSurface(state: IceState, stop: Cell, dir: Dir): HapticSurface {
  const d = DIR_DELTA[dir];
  const r = stop.r + d.r;
  const c = stop.c + d.c;
  if (state.boxes.some((b) => b.r === r && b.c === c)) return 'wood-crate';
  if (state.walls.some((w) => w.r === r && w.c === c)) return 'stone';
  if (r < 0 || c < 0 || r >= state.rows || c >= state.cols) return 'wood-frame';
  const open = new Set(state.open.map(cellKey));
  if (!open.has(`${r},${c}`)) return 'wood-frame';
  return 'none';
}

export function crateOnCrate(state: IceState, stop: Cell, dir: Dir): boolean {
  const d = DIR_DELTA[dir];
  const box = state.boxes.find((b) => b.r === stop.r + d.r && b.c === stop.c + d.c);
  if (!box) return false;
  const nr = box.r + d.r;
  const nc = box.c + d.c;
  return state.boxes.some((b) => b.r === nr && b.c === nc);
}

export function landFeel(
  cells: number,
  surface: HapticSurface,
  onCrate = false,
): LandFeel {
  const amp = hitAmpForCells(cells);
  let intensity = landIntensity(amp);
  if (onCrate && surface === 'wood-crate') intensity *= HAPTIC_CRATE_ON_CRATE;
  return {
    intensity,
    sharpness: sharpnessForSurface(surface),
    jelly: cells >= YOU_HIT_AMP_FULL_CELLS,
  };
}

export function shouldNudge(kind: SlideKind, cells: number): boolean {
  return cells < 1 && kind !== 'slide';
}

/**
 * 位移出手：方向只看 Armed 原点到现在的位移。速度只当门槛，不改方向。
 */
import type { Dir } from './dir';
import {
  DIAGONAL_FORK_RATIO,
  axisOf,
  dirFromDelta,
  type Axis,
  type SegmentDecision,
} from './swipeAxis';

/** 有压感且低于此：当轻触，门槛加高。0.5 是很多机型的默认假压力，不算轻。 */
export const LIGHT_PRESSURE = 0.2;
export const LIGHT_COMMIT_MUL = 1.4;
export const LIGHT_SPEED_MUL = 1.35;
/** 出手后抬手，这么短内的新按下当弹跳，整段忽略。 */
export const POST_FIRE_UP_GUARD_MS = 10;

export function isLightPressure(pressure: number, pointerType: string): boolean {
  if (pointerType !== 'touch' && pointerType !== 'pen') return false;
  return pressure > 0 && pressure < LIGHT_PRESSURE;
}

export type FlickInput = {
  dx: number;
  dy: number;
  axis: Axis | null;
  slop: number;
  commit: number;
  axisRatio: number;
  speed: number;
  speedMin: number;
  slow: boolean;
  fired: boolean;
  legal?: (dir: Dir) => boolean;
  allowFork: boolean;
};

function fork(s: FlickInput): SegmentDecision | null {
  if (!s.allowFork || !s.legal) return null;
  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  if (ax < s.commit || ay < s.commit) return null;
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major <= 0 || minor / major < DIAGONAL_FORK_RATIO) return null;
  const h: Dir = s.dx > 0 ? 1 : 3;
  const v: Dir = s.dy > 0 ? 2 : 0;
  const hOk = s.legal(h);
  const vOk = s.legal(v);
  if (hOk !== vOk) {
    const dir = hOk ? h : v;
    return { axis: axisOf(dir), fire: dir, consume: true };
  }
  if (hOk && vOk) return { axis: null, fire: null, consume: false };
  return { axis: null, fire: null, consume: false };
}

export function decideFlick(s: FlickInput): SegmentDecision {
  if (s.fired || s.slow) {
    return { axis: s.axis, fire: null, consume: false };
  }
  const guessed = dirFromDelta(s.dx, s.dy, s.axisRatio);
  if (guessed === null) {
    return fork(s) ?? { axis: s.axis, fire: null, consume: false };
  }
  const axis = axisOf(guessed);
  const along = axis === 1 ? Math.abs(s.dx) : Math.abs(s.dy);
  if (along < s.commit || s.speed < s.speedMin) {
    return { axis, fire: null, consume: false };
  }
  return { axis, fire: guessed, consume: true };
}

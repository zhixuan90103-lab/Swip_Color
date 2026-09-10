import type { Dir } from './dir';
import {
  DIAGONAL_FORK_RATIO,
  axisOf,
  dirAlongAxis,
  resolveAxis,
  type Axis,
  type SegmentDecision,
} from './swipeAxis';

/** 手感2：甩动。2048 默认。每次按下只一步；慢滑锁死后本按下不再出手。 */
export type Feel2Input = {
  dx: number;
  dy: number;
  axis: Axis | null;
  lastDir: Dir | null;
  slop: number;
  commit: number;
  axisRatio: number;
  speed: number;
  speedMin: number;
  speedX: number;
  speedY: number;
  /** 窗速度带号。与位移反号 = 回弹，不出手。缺省当与位移同号。 */
  vx?: number;
  vy?: number;
  legal?: (dir: Dir) => boolean;
  slowDrag: boolean;
};

function velAgrees(disp: number, vel: number | undefined): boolean {
  if (vel === undefined) return true;
  return disp * vel > 0;
}

function dirReady(s: Feel2Input, dir: Dir): boolean {
  if (!s.legal?.(dir)) return false;
  const horiz = dir === 1 || dir === 3;
  const spd = horiz ? s.speedX : s.speedY;
  if (spd < s.speedMin) return false;
  const disp = horiz ? s.dx : s.dy;
  const vel = horiz ? s.vx : s.vy;
  return velAgrees(disp, vel);
}

/** 未锁轴且两轴都够 commit、偏角 ≥ 40°：只走「唯一能走的那一向」。 */
function diagonalFork(s: Feel2Input): SegmentDecision | null {
  if (!s.legal) return null;
  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  if (ax < s.commit || ay < s.commit) return null;
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major <= 0 || minor / major < DIAGONAL_FORK_RATIO) return null;

  const h: Dir = s.dx > 0 ? 1 : 3;
  const v: Dir = s.dy > 0 ? 2 : 0;
  const hOk = dirReady(s, h);
  const vOk = dirReady(s, v);

  if (hOk !== vOk) {
    const dir = hOk ? h : v;
    if (dir === s.lastDir) {
      return { axis: axisOf(dir), fire: null, consume: true };
    }
    return { axis: axisOf(dir), fire: dir, consume: true };
  }
  if (hOk && vOk) return { axis: null, fire: null, consume: false };

  const hLegal = s.legal(h);
  const vLegal = s.legal(v);
  if (!hLegal && !vLegal) {
    if (s.lastDir !== null) return { axis: null, fire: null, consume: false };
    return { axis: null, fire: null, consume: true, dead: ay >= ax ? v : h };
  }
  return { axis: null, fire: null, consume: false };
}

export function evaluateFeel2(s: Feel2Input): SegmentDecision {
  if (s.lastDir !== null || s.slowDrag) {
    return { axis: s.axis, fire: null, consume: false };
  }

  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  let axis = resolveAxis(s);
  if (axis === null) {
    return diagonalFork(s) ?? { axis: null, fire: null, consume: false };
  }

  const along = axis === 1 ? ax : ay;
  if (along <= 0 || along < s.commit) {
    return { axis, fire: null, consume: false };
  }

  if (s.speed < s.speedMin) {
    return { axis, fire: null, consume: false };
  }

  const disp = axis === 1 ? s.dx : s.dy;
  const vel = axis === 1 ? s.vx : s.vy;
  if (!velAgrees(disp, vel)) {
    return { axis, fire: null, consume: false };
  }

  const dir = dirAlongAxis(s.dx, s.dy, axis);
  return { axis, fire: dir, consume: true };
}

/**
 * 位移出手：方向看按下点到现在的主轴符号。速度只当门槛。
 * 设计见 docs/SWIPE-INTENT.md。
 */
import { axisOf, dirFromDelta, type SegmentDecision } from './swipeAxis';

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
  commit: number;
  axisRatio: number;
  speed: number;
  speedMin: number;
  slow: boolean;
  fired: boolean;
};

export function decideFlick(s: FlickInput): SegmentDecision {
  if (s.fired || s.slow) {
    return { axis: null, fire: null, consume: false };
  }
  const guessed = dirFromDelta(s.dx, s.dy, s.axisRatio);
  if (guessed === null) {
    return { axis: null, fire: null, consume: false };
  }
  const axis = axisOf(guessed);
  const along = axis === 1 ? Math.abs(s.dx) : Math.abs(s.dy);
  if (along < s.commit || s.speed < s.speedMin) {
    return { axis, fire: null, consume: false };
  }
  return { axis, fire: guessed, consume: true };
}

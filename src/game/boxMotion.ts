import type { Dir } from './iceTypes';
import { YOU_HIT_AMP_MIN, hitTimesForAmp } from './youMotion';

/** Hard crate: little squash, more shove + rock. */
export const BOX_HIT_IN_DIST = 4;
export const BOX_HIT_HOP = 4;
export const BOX_HIT_SQUASH = 0.05;
export const BOX_HIT_LEAN = 7;
export const BOX_HIT_LEAN_UD = 4;
export const BOX_HIT_BACK_MS = 240;
export const BOX_HIT_BACK_FAST_MS = 200;

export type BoxMotion = {
  startHit: (root: HTMLElement, dir: Dir, now: number, amp: number) => void;
  abort: () => void;
  tick: (now: number) => void;
};

function dirStep(dir: Dir): { x: number; y: number } {
  if (dir === 'left') return { x: -1, y: 0 };
  if (dir === 'right') return { x: 1, y: 0 };
  if (dir === 'up') return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function createBoxMotion(): BoxMotion {
  let root: HTMLElement | null = null;
  let rig: HTMLElement | null = null;
  let on = false;
  let dir: Dir | null = null;
  let t0 = 0;
  let amp = 1;
  let inMs = 70;
  let backMs = BOX_HIT_BACK_MS;
  let alongMul = 1;
  let hopMul = 1;
  let leanMul = 1;
  let twist = 1;
  let sideMul = 0;
  let knockDecay = 6.2;
  let hopDecay = 5.2;
  let rotDecay = 2.6;
  let rotTurns = 2.2;

  function mix(a: number, b: number): number {
    return a + Math.random() * (b - a);
  }

  function clearOff(): void {
    root?.style.setProperty('--box-hit-x', '0px');
    root?.style.setProperty('--box-hit-y', '0px');
    if (rig) {
      rig.style.transformOrigin = '50% 50%';
      rig.style.transform = 'rotate(0deg) scale(1, 1)';
    }
  }

  return {
    startHit(nextRoot, nextDir, now, nextAmp) {
      root = nextRoot;
      rig = nextRoot.querySelector('.box-rig');
      on = true;
      dir = nextDir;
      t0 = now;
      amp = nextAmp;
      const t = hitTimesForAmp(nextAmp);
      inMs = t.inMs;
      const span = 1 - YOU_HIT_AMP_MIN;
      const u = span <= 0 ? 1 : Math.min(1, Math.max(0, (nextAmp - YOU_HIT_AMP_MIN) / span));
      backMs = BOX_HIT_BACK_MS + (BOX_HIT_BACK_FAST_MS - BOX_HIT_BACK_MS) * u + mix(-35, 45);
      alongMul = mix(0.72, 1.12);
      hopMul = mix(0.35, 1.05);
      leanMul = mix(0.75, 1.12);
      twist = Math.random() < 0.22 ? -1 : 1;
      sideMul = mix(-0.35, 0.35);
      knockDecay = mix(5.4, 7.2);
      hopDecay = mix(4.4, 6.4);
      rotDecay = mix(2.2, 3.2);
      rotTurns = mix(1.8, 2.6);
      if (Math.random() < 0.18) {
        hopMul *= 0.45;
        alongMul *= 0.85;
        leanMul *= 0.8;
      }
    },
    abort() {
      on = false;
      dir = null;
      clearOff();
      root = null;
      rig = null;
    },
    tick(now) {
      if (!on || !dir || !root) return;
      const elapsed = now - t0;
      const d = dirStep(dir);
      let knock = 0;
      let hop = 0;
      let uBack = 0;
      if (elapsed < inMs) {
        knock = easeOutCubic(elapsed / inMs);
        const k = elapsed / inMs;
        hop = k * k * (3 - 2 * k);
      } else {
        uBack = Math.min(1, (elapsed - inMs) / backMs);
        knock = Math.exp(-knockDecay * uBack);
        hop = Math.exp(-hopDecay * uBack);
      }
      const along = BOX_HIT_IN_DIST * amp * alongMul * knock;
      const hopPx = BOX_HIT_HOP * hop * amp * hopMul;
      const side = BOX_HIT_IN_DIST * amp * sideMul * knock;
      const hitX = d.x * along + d.y * side;
      const hitY = d.y * along - d.x * side - hopPx;
      const into = Math.max(0, knock);
      const axis = 1 - BOX_HIT_SQUASH * amp * into;
      let sx = 1;
      let sy = 1;
      if (d.x !== 0) sx = axis;
      else sy = axis;
      const sign = d.x !== 0 ? d.x : d.y;
      const leanAmp = (d.x !== 0 ? BOX_HIT_LEAN : BOX_HIT_LEAN_UD) * sign * twist * amp * leanMul;
      const tot = inMs + backMs;
      const uRot = Math.min(1, elapsed / tot);
      const rot = leanAmp * Math.exp(-rotDecay * uRot) * Math.cos(uRot * Math.PI * rotTurns);
      root.style.setProperty('--box-hit-x', `${hitX.toFixed(2)}px`);
      root.style.setProperty('--box-hit-y', `${hitY.toFixed(2)}px`);
      if (rig) {
        rig.style.transformOrigin = '50% 50%';
        rig.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      }
      if (elapsed >= inMs + backMs) {
        on = false;
        dir = null;
        clearOff();
      }
    },
  };
}

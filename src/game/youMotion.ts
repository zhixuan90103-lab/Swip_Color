import type { Dir } from './iceTypes';

/** Locked idle: L stretch → center squat hold → R stretch → center squat hold. */
export const YOU_PERIOD_MIN = 1.55;
export const YOU_PERIOD_MAX = 1.95;
export const YOU_LEAN_MIN = 0.5;
export const YOU_LEAN_MAX = 1;
export const YOU_SQUASH_MIN = 0.09;
export const YOU_SQUASH_MAX = 0.15;
export const YOU_STRETCH_MIN = 0.2;
export const YOU_STRETCH_MAX = 0.3;
export const YOU_SWAY_PERIOD = 1.7;

export const YOU_SLIDE_LEAN = 14;
export const YOU_SLIDE_STRETCH = 0.22;
export const YOU_SLIDE_EYE = 0.16;
export const PUSH_STEP_MS = 90;
export const YOU_HIT_AMP_FULL_CELLS = 7;

export const YOU_HIT_OVERLAP = 18;
export const YOU_HIT_IN_DIST = 26;
export const YOU_HIT_RECOIL = 2.6;
/** In-place (45%) timing. Full-amp slide hits use the FAST pair. */
export const YOU_HIT_IN_MS = 70;
export const YOU_HIT_BACK_MS = 300;
export const YOU_HIT_IN_FAST_MS = 55;
export const YOU_HIT_BACK_FAST_MS = 255;
export const YOU_HIT_TOTAL_MS = YOU_HIT_IN_FAST_MS + YOU_HIT_BACK_FAST_MS;
export const YOU_HIT_SQUASH = 0.34;
export const YOU_HIT_STRETCH = 0.28;
export const YOU_HIT_LEAN = 22;
export const YOU_HIT_LEAN_UD = 8;
/** 0-cell and 1-cell floor. 7+ cells = 1. */
export const YOU_HIT_AMP_MIN = 0.45;

export const YOU_BLINK_DUR = 0.18;
export const YOU_BLINK_LID = 0.3;
export const YOU_BLINK_HOME_LID = 0.5;
export const YOU_LOOK_PX = 7;

export type LookTarget = { key: string; x: number; y: number };

export type YouMotion = {
  bind: (root: HTMLElement | null, rig: HTMLElement | null, eye: HTMLElement | null, pupil: HTMLElement | null) => void;
  startSlide: (dir: Dir, now: number) => void;
  endSlide: () => void;
  startHit: (dir: Dir, now: number, cells: number) => void;
  abort: () => void;
  tick: (now: number) => void;
};

export function hitAmpForCells(cells: number): number {
  if (cells < 1) return YOU_HIT_AMP_MIN;
  if (cells >= YOU_HIT_AMP_FULL_CELLS) return 1;
  return YOU_HIT_AMP_MIN + (1 - YOU_HIT_AMP_MIN) * ((cells - 1) / (YOU_HIT_AMP_FULL_CELLS - 1));
}

export function hitTimesForAmp(amp: number): { inMs: number; backMs: number } {
  const span = 1 - YOU_HIT_AMP_MIN;
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (amp - YOU_HIT_AMP_MIN) / span));
  return {
    inMs: YOU_HIT_IN_MS + (YOU_HIT_IN_FAST_MS - YOU_HIT_IN_MS) * t,
    backMs: YOU_HIT_BACK_MS + (YOU_HIT_BACK_FAST_MS - YOU_HIT_BACK_MS) * t,
  };
}

export function hitDurationMs(cells: number): number {
  const { inMs, backMs } = hitTimesForAmp(hitAmpForCells(cells));
  return inMs + backMs;
}

export function createYouMotion(opts: { getLookTargets: () => LookTarget[] }): YouMotion {
  let root: HTMLElement | null = null;
  let rig: HTMLElement | null = null;
  let eye: HTMLElement | null = null;
  let pupil: HTMLElement | null = null;

  let blinkStart = 0;
  let nextBlinkAt = 0;
  let doubleBlink = false;
  let blinkHalf = false;
  let lookHomePending = false;
  let lookX = 0;
  let lookY = 0;
  let lookFromX = 0;
  let lookFromY = 0;
  let lookTX = 0;
  let lookTY = 0;
  let lookStart = 0;
  let lookKey = '';
  let phase = 0;
  let rate = 1 / YOU_SWAY_PERIOD;
  let leanAmp = 0.75;
  let squashAmp = 0.12;
  let stretchAmp = 0.25;
  let leanAmpT = 0.75;
  let squashAmpT = 0.12;
  let stretchAmpT = 0.25;
  let rateT = 1 / YOU_SWAY_PERIOD;
  let prev = 0;
  let lean = 0;
  let leanVel = 0;
  let sy = 1;
  let syVel = 0;
  let slideDir: Dir | null = null;
  let slideRot = 0;
  let slideRotVel = 0;
  let slideStr = 0;
  let slideStrVel = 0;
  let slideEyeStart = 0;
  let slideLooked = false;
  let slideLookDir: Dir | null = null;
  let hitOn = false;
  let hitDir: Dir | null = null;
  let hitT0 = 0;
  let hitFromRot = 0;
  let hitOffX = 0;
  let hitOffY = 0;
  let hitOffXVel = 0;
  let hitOffYVel = 0;
  let hitAmp = 1;
  let hitInMs = YOU_HIT_IN_FAST_MS;
  let hitBackMs = YOU_HIT_BACK_FAST_MS;

  function mix(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  function rollIdle(): void {
    rateT = 1 / mix(YOU_PERIOD_MIN, YOU_PERIOD_MAX);
    leanAmpT = mix(YOU_LEAN_MIN, YOU_LEAN_MAX);
    squashAmpT = mix(YOU_SQUASH_MIN, YOU_SQUASH_MAX);
    stretchAmpT = mix(YOU_STRETCH_MIN, YOU_STRETCH_MAX);
  }

  function leanWave(u: number): number {
    const half = u < 0.5 ? u * 2 : (u - 0.5) * 2;
    const sign = u < 0.5 ? 1 : -1;
    if (half < 0.16) return 0;
    if (half < 0.5) return sign * easeInOutCubic((half - 0.16) / 0.34);
    if (half < 0.54) return sign;
    if (half < 0.88) return sign * (1 - easeInOutCubic((half - 0.54) / 0.34));
    return 0;
  }

  function lookTowardDir(dir: Dir, now: number): void {
    lookFromX = lookX;
    lookFromY = lookY;
    lookStart = now;
    lookKey = `dir-${dir}`;
    const m = YOU_LOOK_PX;
    if (dir === 'left') {
      lookTX = -m;
      lookTY = 0;
    } else if (dir === 'right') {
      lookTX = m;
      lookTY = 0;
    } else if (dir === 'up') {
      lookTX = 0;
      lookTY = -m;
    } else {
      lookTX = 0;
      lookTY = m;
    }
  }

  function pickLook(now: number): void {
    lookFromX = lookX;
    lookFromY = lookY;
    lookStart = now;
    const boardOpts = opts.getLookTargets();
    const onScreen = lookKey === 'screen' || lookKey === '';
    if (onScreen) {
      if (boardOpts.length === 0) {
        lookKey = 'screen';
        lookTX = 0;
        lookTY = 0;
        return;
      }
      const pick = boardOpts[Math.floor(Math.random() * boardOpts.length)]!;
      lookKey = pick.key;
      lookTX = pick.x;
      lookTY = pick.y;
      return;
    }
    if (Math.random() < 0.72 || boardOpts.length <= 1) {
      lookKey = 'screen';
      lookTX = 0;
      lookTY = 0;
      return;
    }
    const pool = boardOpts.filter((o) => o.key !== lookKey);
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? boardOpts[0]!;
    lookKey = pick.key;
    lookTX = pick.x;
    lookTY = pick.y;
  }

  function dirStep(dir: Dir): { x: number; y: number } {
    if (dir === 'left') return { x: -1, y: 0 };
    if (dir === 'right') return { x: 1, y: 0 };
    if (dir === 'up') return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  }

  rollIdle();

  return {
    bind(nextRoot, nextRig, nextEye, nextPupil) {
      root = nextRoot;
      rig = nextRig;
      eye = nextEye;
      pupil = nextPupil;
      prev = 0;
    },
    startSlide(dir, now) {
      hitOn = false;
      hitDir = null;
      slideDir = dir;
      slideLookDir = dir;
      slideEyeStart = now;
      slideLooked = false;
      blinkStart = 0;
      doubleBlink = false;
    },
    endSlide() {
      slideDir = null;
    },
    startHit(dir, now, cells) {
      hitOn = true;
      hitDir = dir;
      hitT0 = now;
      hitFromRot = slideRot;
      hitAmp = hitAmpForCells(cells);
      const times = hitTimesForAmp(hitAmp);
      hitInMs = times.inMs;
      hitBackMs = times.backMs;
      if (slideLookDir && !slideLooked) {
        lookTowardDir(slideLookDir, now);
        slideLooked = true;
      }
    },
    abort() {
      slideDir = null;
      hitOn = false;
      hitDir = null;
    },
    tick(now) {
      if (!rig) return;
      if (prev === 0) prev = now;
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (!slideDir && !hitOn) {
        phase += dt * rate;
        if (phase >= 1) {
          phase -= 1;
          rollIdle();
        }
        const fade = 1 - Math.exp(-dt * 2.4);
        rate += (rateT - rate) * fade;
        leanAmp += (leanAmpT - leanAmp) * fade;
        squashAmp += (squashAmpT - squashAmp) * fade;
        stretchAmp += (stretchAmpT - stretchAmp) * fade;
        const wave = leanWave(phase);
        const targetLean = wave * leanAmp;
        leanVel += (targetLean - lean) * 20 * dt;
        leanVel *= Math.exp(-6.8 * dt);
        lean += leanVel * dt;
        const side = Math.min(1, Math.abs(wave));
        let targetSy = 1 - squashAmp * (1 - side) + stretchAmp * side;
        if (side < 0.12) targetSy += 0.018 * Math.sin(now * 0.011);
        syVel += (targetSy - sy) * 16 * dt;
        syVel *= Math.exp(-5.8 * dt);
        sy += syVel * dt;
      } else {
        leanVel += (0 - lean) * 48 * dt;
        leanVel *= Math.exp(-10 * dt);
        lean += leanVel * dt;
        syVel += (1 - sy) * 48 * dt;
        syVel *= Math.exp(-10 * dt);
        sy += syVel * dt;
      }
      let tRot = 0;
      let tStr = 0;
      if (slideDir === 'left') tRot = -YOU_SLIDE_LEAN;
      else if (slideDir === 'right') tRot = YOU_SLIDE_LEAN;
      if (slideDir) tStr = YOU_SLIDE_STRETCH;
      if (!hitOn) {
        const slideK = slideDir ? 52 : 20;
        const slideD = slideDir ? 10 : 8;
        slideRotVel += (tRot - slideRot) * slideK * dt;
        slideRotVel *= Math.exp(-slideD * dt);
        slideRot += slideRotVel * dt;
        slideStrVel += (tStr - slideStr) * slideK * dt;
        slideStrVel *= Math.exp(-slideD * dt);
        slideStr += slideStrVel * dt;
      }
      let hitSx = 1;
      let hitSy = 1;
      let hitX = 0;
      let hitY = 0;
      let hitRot = slideRot;
      let hitEyeX = 0;
      let hitEyeY = 0;
      let rigOrigin = '50% 100%';
      if (hitOn && hitDir) {
        const elapsed = now - hitT0;
        const d = dirStep(hitDir);
        let bounce = 0;
        if (elapsed < hitInMs) {
          bounce = easeOutCubic(elapsed / hitInMs);
        } else {
          const u = Math.min(1, (elapsed - hitInMs) / hitBackMs);
          bounce = Math.exp(-3.1 * u) * Math.cos(u * Math.PI * 2.15);
        }
        const amp = hitAmp;
        const dist =
          bounce < 0 ? YOU_HIT_OVERLAP * YOU_HIT_RECOIL * bounce * amp : YOU_HIT_IN_DIST * bounce * amp;
        const uBack = Math.max(0, (elapsed - hitInMs) / hitBackMs);
        hitX = d.x * dist;
        hitY = d.y * dist;
        const into = Math.max(0, bounce);
        const away = Math.max(0, -bounce);
        const axis = 1 - YOU_HIT_SQUASH * amp * into + YOU_HIT_STRETCH * amp * away;
        if (d.x !== 0) {
          hitSx = axis;
          hitSy = 1 + 0.08 * amp * into - 0.06 * amp * away;
        } else {
          // Y squash about the torso, not the feet — travel still on --you-hit-y.
          rigOrigin = '50% 50%';
          hitSy = axis;
          const vol = 1 / Math.max(0.55, axis) - 1;
          hitSx = 1 + vol * 0.72;
        }
        const slamRot = d.x !== 0 ? YOU_HIT_LEAN * (d.x < 0 ? -1 : 1) : 0;
        const peakRot = hitFromRot + (slamRot - hitFromRot) * amp;
        const sway =
          elapsed > hitInMs && d.x !== 0
            ? Math.exp(-2.4 * Math.min(1, uBack)) * Math.cos(Math.min(1, uBack) * Math.PI * 2) * amp
            : 0;
        if (elapsed < hitInMs) {
          hitRot = hitFromRot + (peakRot - hitFromRot) * bounce;
        } else {
          hitRot = peakRot * bounce + 8 * sway;
          const u = Math.min(1, uBack);
          const eyeDamp = Math.exp(-2.15 * u) * (1 - u);
          hitEyeX =
            amp * eyeDamp * (d.x * 3.4 * Math.cos(u * Math.PI * 2.35) + d.y * 1.15 * Math.sin(u * Math.PI * 2.7));
          hitEyeY =
            amp * eyeDamp * (d.y * 2.8 * Math.cos(u * Math.PI * 2.2) + d.x * 1.05 * Math.sin(u * Math.PI * 2.55));
        }
        slideRot = hitRot;
        hitOffX = hitX;
        hitOffY = hitY;
        hitOffXVel = 0;
        hitOffYVel = 0;
        if (elapsed >= hitInMs + hitBackMs) {
          lean += hitRot;
          sy = d.x === 0 ? 1 : hitSy;
          leanVel = 0;
          syVel = 0;
          slideRot = 0;
          slideRotVel = 0;
          slideStr = 0;
          slideStrVel = 0;
          phase = 0;
          hitOn = false;
          hitDir = null;
          lookHomePending = true;
          blinkStart = 0;
          nextBlinkAt = now;
          doubleBlink = false;
          hitSx = 1;
          hitSy = 1;
          hitRot = 0;
        }
      } else {
        hitOffXVel += (0 - hitOffX) * 22 * dt;
        hitOffXVel *= Math.exp(-9.5 * dt);
        hitOffX += hitOffXVel * dt;
        hitOffYVel += (0 - hitOffY) * 22 * dt;
        hitOffYVel *= Math.exp(-9.5 * dt);
        hitOffY += hitOffYVel * dt;
        if (Math.abs(hitOffX) < 0.04 && Math.abs(hitOffXVel) < 0.2) hitOffX = 0;
        if (Math.abs(hitOffY) < 0.04 && Math.abs(hitOffYVel) < 0.2) hitOffY = 0;
        hitX = hitOffX;
        hitY = hitOffY;
      }
      root?.style.setProperty('--you-hit-x', `${hitX.toFixed(2)}px`);
      root?.style.setProperty('--you-hit-y', `${hitY.toFixed(2)}px`);
      const baseSy = hitOn ? 1 : sy * (1 + slideStr);
      const outSy = baseSy * hitSy;
      const outSx = (hitOn ? 1 / baseSy : 1 / (sy * (1 + slideStr))) * hitSx;
      const rot = lean + (hitOn ? hitRot : slideRot);
      rig.style.transformOrigin = rigOrigin;
      rig.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${outSx.toFixed(4)}, ${outSy.toFixed(4)})`;
      if (eye) {
        let lid = 1;
        if (slideEyeStart > 0) {
          const t = (now - slideEyeStart) / (YOU_SLIDE_EYE * 1000);
          if (t >= 1) {
            if (!slideLooked && slideLookDir) {
              lookTowardDir(slideLookDir, now);
              slideLooked = true;
            }
            slideEyeStart = 0;
            lid = 1;
          } else if (t < 0.4) {
            lid = 1 - 0.28 * easeInCubic(t / 0.4);
          } else {
            if (!slideLooked && slideLookDir) {
              lookTowardDir(slideLookDir, now);
              slideLooked = true;
            }
            lid = 0.72 + 0.28 * easeOutCubic((t - 0.4) / 0.6);
          }
        } else if (!slideDir && !hitOn) {
          if (nextBlinkAt === 0) nextBlinkAt = now + mix(2.3, 5.5) * 1000;
          if (blinkStart === 0 && now >= nextBlinkAt) {
            blinkStart = now;
            if (lookHomePending) {
              lookHomePending = false;
              blinkHalf = true;
              lookFromX = lookX;
              lookFromY = lookY;
              lookTX = 0;
              lookTY = 0;
              lookStart = now;
              lookKey = 'screen';
              doubleBlink = false;
            } else if (!doubleBlink) {
              pickLook(now);
              doubleBlink = Math.random() < 0.22;
            } else {
              doubleBlink = false;
            }
          }
          if (blinkStart > 0) {
            const t = (now - blinkStart) / (YOU_BLINK_DUR * 1000);
            if (t >= 1) {
              blinkStart = 0;
              blinkHalf = false;
              nextBlinkAt = doubleBlink ? now + 90 : now + mix(2.3, 5.5) * 1000;
            } else {
              lid = blinkLid(t, blinkHalf ? YOU_BLINK_HOME_LID : YOU_BLINK_LID);
            }
          }
        }
        eye.style.transform = `scaleY(${lid.toFixed(3)})`;
      }
      if (pupil) {
        const saccade = lookStart === 0 ? 1 : Math.min(1, (now - lookStart) / 90);
        const e = easeOutCubic(saccade);
        lookX = lerp(lookFromX, lookTX, e);
        lookY = lerp(lookFromY, lookTY, e);
        pupil.style.transform = `translate(${(lookX + hitEyeX).toFixed(2)}px, ${(lookY + hitEyeY).toFixed(2)}px)`;
      }
    },
  };
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blinkLid(t: number, open: number): number {
  const close = 1 - open;
  if (t < 0.3) return 1 - close * easeInCubic(t / 0.3);
  if (t < 0.46) return open;
  return open + close * easeOutCubic((t - 0.46) / 0.54);
}

/**
 * 手势层。一次按下只出手一步；方向看按下点到现在的主轴符号。
 * 设计见 docs/SWIPE-INTENT.md。
 */

import { DESIGN_SAFE, DESIGN_WIDTH } from '../adapt/design';
import type { Dir } from './dir';
import { FEEL1_DEFAULT, type Feel } from './feel';
import {
  commitForIntent,
  decideFlick,
  isLightPressure,
  LIGHT_COMMIT_MUL,
  LIGHT_SPEED_MUL,
  POST_FIRE_UP_GUARD_MS,
} from './swipeFlick';
import { shouldInvalidOnLift, shouldLatchSlowDrag } from './swipeAxis';
import {
  clientInStage,
  clientInSystemEdge,
  isStalePointer,
} from './swipeGuard';
import { alongSpeed, createVelocityWindow } from './swipeVelocity';

export type SwipeInputOptions = {
  target: HTMLElement;
  getFeel?: () => Feel;
  isBlocked?: () => boolean;
  /** 为 false 时挡住不出手也不排队（转场）。默认 true：滑棋中可存一步。 */
  canQueue?: () => boolean;
  onMove: (dir: Dir) => void;
  onInvalid?: (dir: Dir) => void;
  onBackgroundAbort?: () => void;
  onGestureCommit?: () => void;
};

export type SwipeHandle = {
  dispose: () => void;
  onMoveSettled: () => void;
  /** 丢掉已存的下一步，并吞掉当前这根手指（转场用）。 */
  cancelInput: () => void;
  isHolding: () => boolean;
};

function isChrome(el: EventTarget | null): boolean {
  return (
    el instanceof Element &&
    !!el.closest('button, a, input, #device-switcher, #feel-panel, #g-title')
  );
}

type Gesture = {
  pid: number;
  downTs: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  lastT: number;
  armed: boolean;
  fired: boolean;
  slow: boolean;
  ignore: boolean;
  light: boolean;
  vel: ReturnType<typeof createVelocityWindow>;
};

export function attachSwipeInput(opts: SwipeInputOptions): SwipeHandle {
  const { target, onMove, onInvalid, isBlocked, canQueue, onBackgroundAbort, onGestureCommit } =
    opts;
  const feelOf = () => opts.getFeel?.() ?? FEEL1_DEFAULT;
  let g: Gesture | null = null;
  let pending: Dir | null = null;
  let lastFireAt = 0;
  let lastFiredUpTs = 0;
  let lastFireDir: Dir | null = null;
  let commitTimer = 0;
  const BG_GUARD_MS = 800;

  const cssPx = (name: string, fallback: number) => {
    const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const stageBox = () => target.getBoundingClientRect();

  const scalePx = (designPx: number) => {
    const w = target.getBoundingClientRect().width;
    const s = w > 0 ? w / DESIGN_WIDTH : 1;
    return designPx * s;
  };

  const inSystemEdge = (clientY: number) => {
    const box = stageBox();
    const native = document.documentElement.classList.contains('native-app');
    const topBand = (native ? cssPx('--safe-top', DESIGN_SAFE.top) : scalePx(DESIGN_SAFE.top)) + 4;
    const botBand =
      (native ? cssPx('--safe-bottom', DESIGN_SAFE.bottom) : scalePx(DESIGN_SAFE.bottom)) + 4;
    return clientInSystemEdge(clientY, box, topBand, botBand);
  };

  const emit = (dir: Dir) => {
    lastFireAt = performance.now();
    lastFireDir = dir;
    onMove(dir);
  };

  const tryFlick = () => {
    if (!g || g.ignore || g.fired || !g.armed) return;
    const feel = feelOf();
    if (feel.scheme !== 2) return;
    const dx = g.x - g.ox;
    const dy = g.y - g.oy;
    const slop = scalePx(feel.slopPx);
    const lightMul = g.light ? LIGHT_COMMIT_MUL : 1;
    const fullCommit = scalePx(feel.commitPx) * lightMul;
    const commit = commitForIntent(fullCommit, slop, lastFireDir, dx, dy, feel.axisRatio);
    const blocked = Boolean(isBlocked?.());
    const spd = g.vel.axisSpeed(g.lastT);
    const speed = alongSpeed(spd, Math.abs(dx) >= Math.abs(dy) ? 1 : 0);
    const speedMin = scalePx(feel.speedPxS) * (g.light ? LIGHT_SPEED_MUL : 1);
    if (!g.slow && shouldLatchSlowDrag(Math.max(Math.abs(dx), Math.abs(dy)), speed, fullCommit, speedMin)) {
      g.slow = true;
    }
    const d = decideFlick({
      dx,
      dy,
      commit,
      axisRatio: feel.axisRatio,
      speed,
      speedMin,
      slow: g.slow,
      fired: g.fired,
    });
    if (d.fire === null) return;
    if (blocked) {
      if (canQueue?.() ?? true) {
        g.fired = true;
        pending = d.fire;
      }
      return;
    }
    g.fired = true;
    emit(d.fire);
  };

  const startG = (e: PointerEvent) => {
    const vel = createVelocityWindow();
    vel.reset(e.timeStamp, e.clientX, e.clientY);
    g = {
      pid: e.pointerId,
      downTs: e.timeStamp,
      ox: e.clientX,
      oy: e.clientY,
      x: e.clientX,
      y: e.clientY,
      lastT: e.timeStamp,
      armed: false,
      fired: false,
      slow: false,
      ignore: inSystemEdge(e.clientY),
      light: isLightPressure(e.pressure, e.pointerType),
      vel,
    };
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isChrome(e.target)) return;
    if (!clientInStage(e.clientX, e.clientY, stageBox())) return;
    if (g && !g.fired) return;
    if (lastFiredUpTs > 0 && e.timeStamp - lastFiredUpTs < POST_FIRE_UP_GUARD_MS) return;
    e.preventDefault();
    startG(e);
    target.focus({ preventScroll: true });
  };

  const applyPoint = (t: number, x: number, y: number) => {
    if (!g) return;
    g.x = x;
    g.y = y;
    g.lastT = t;
    g.vel.push(t, x, y);
    const feel = feelOf();
    const slop = scalePx(feel.slopPx);
    if (!g.armed) {
      const dist = Math.max(Math.abs(x - g.ox), Math.abs(y - g.oy));
      if (dist < slop) return;
      g.armed = true;
      return;
    }
    tryFlick();
  };

  const onMovePtr = (e: PointerEvent) => {
    if (!g) return;
    if (e.pointerId !== g.pid || isStalePointer(e.timeStamp, g.downTs)) return;
    e.preventDefault();
    g.light = isLightPressure(e.pressure, e.pointerType);
    const batch = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const m of batch) applyPoint(m.timeStamp, m.clientX, m.clientY);
  };

  const onUp = (e: PointerEvent) => {
    if (!g) return;
    if (e.pointerId !== g.pid || isStalePointer(e.timeStamp, g.downTs)) return;
    g.x = e.clientX;
    g.y = e.clientY;
    const feel = feelOf();
    if (feel.scheme === 2 && !g.fired && !g.ignore) {
      tryFlick();
      if (!g.fired && g.armed) {
        const slop = scalePx(feel.slopPx);
        const commit = scalePx(feel.commitPx);
        const dist = Math.max(Math.abs(g.x - g.ox), Math.abs(g.y - g.oy));
        if (shouldInvalidOnLift({ lastDir: null, dist, slop, commit })) {
          const dx = g.x - g.ox;
          const dy = g.y - g.oy;
          const dir: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : dy >= 0 ? 2 : 0;
          onInvalid?.(dir);
        }
      }
    }
    const fired = g.fired;
    if (fired) lastFiredUpTs = e.timeStamp;
    g = null;
    window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(() => {
      if (fired) onGestureCommit?.();
    }, BG_GUARD_MS);
  };

  const onCancel = (e: PointerEvent) => {
    if (!g) return;
    if (e.pointerId !== g.pid) return;
    g = null;
  };

  const cancelInput = () => {
    pending = null;
    if (g) {
      g.ignore = true;
      g.fired = true;
    }
  };

  const onMoveSettled = () => {
    if (pending !== null) {
      const dir = pending;
      pending = null;
      emit(dir);
      return;
    }
    if (g && !g.fired) tryFlick();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (isBlocked?.()) return;
    const map: Record<string, Dir> = {
      ArrowUp: 0,
      ArrowRight: 1,
      ArrowDown: 2,
      ArrowLeft: 3,
      w: 0,
      d: 1,
      s: 2,
      a: 3,
      W: 0,
      D: 1,
      S: 2,
      A: 3,
    };
    const dir = map[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    onMove(dir);
  };

  const dropHoldForBackground = (force = false) => {
    if (!force && document.visibilityState === 'visible') return;
    const recent = g?.fired && performance.now() - lastFireAt < BG_GUARD_MS;
    const had = g;
    g = null;
    pending = null;
    window.clearTimeout(commitTimer);
    if (recent) onBackgroundAbort?.();
    else if (had) onGestureCommit?.();
  };

  const onVis = () => {
    if (document.visibilityState === 'hidden') dropHoldForBackground();
  };
  const onHide = () => dropHoldForBackground(true);

  const peOpts: AddEventListenerOptions = { capture: true, passive: false };
  target.tabIndex = 0;
  window.addEventListener('pointerdown', onDown, peOpts);
  window.addEventListener('pointermove', onMovePtr, peOpts);
  window.addEventListener('pointerup', onUp, peOpts);
  window.addEventListener('pointercancel', onCancel, peOpts);
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('blur', onHide);
  document.addEventListener('freeze', onHide);

  return {
    onMoveSettled,
    cancelInput,
    isHolding: () => g !== null,
    dispose: () => {
      window.clearTimeout(commitTimer);
      window.removeEventListener('pointerdown', onDown, peOpts);
      window.removeEventListener('pointermove', onMovePtr, peOpts);
      window.removeEventListener('pointerup', onUp, peOpts);
      window.removeEventListener('pointercancel', onCancel, peOpts);
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('blur', onHide);
      document.removeEventListener('freeze', onHide);
      g = null;
    },
  };
}

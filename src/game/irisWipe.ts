/** Close: star hole shrinks to black. Open: hole grows until the stage is clear. */
export const IRIS_IN_MS = 780;
export const IRIS_HOLD_MS = 500;
export const IRIS_OUT_MS = 860;
/**
 * Star path is 100×100 centered via translate(-50,-50).
 * Inner radius ≈ 20 local units; stage half-diagonal ≈ 465 → scale > 24.
 */
export const IRIS_OPEN_SCALE = 32;
export const IRIS_CLOSED_SCALE = 0.002;
/** Start each fade already rotated this much; scale-end is upright (0°). */
export const IRIS_SPIN_DEG = 60;

const STAR_PATH =
  'M50 8 L61.8 39.2 L95 40.2 L68.4 60.4 L77.6 92.5 L50 74.2 L22.4 92.5 L31.6 60.4 L5 40.2 L38.2 39.2 Z';

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function tween(
  from: number,
  to: number,
  ms: number,
  ease: (t: number) => number,
  apply: (v: number) => void,
  isDead: () => boolean,
): Promise<void> {
  if (ms <= 0) {
    apply(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const tick = (now: number) => {
      if (isDead()) {
        apply(to);
        resolve();
        return;
      }
      const u = Math.min(1, (now - t0) / ms);
      apply(from + (to - from) * ease(u));
      if (u < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

export type IrisWipe = {
  play(swap: () => void): Promise<void>;
  dispose(): void;
};

export function createIrisWipe(
  host: HTMLElement,
  opts: { prefersReduce: () => boolean; isDead: () => boolean },
): IrisWipe {
  const NS = 'http://www.w3.org/2000/svg';
  const maskId = 'ice-iris-mask';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'ice-iris is-idle');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', '0 0 390 844');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.innerHTML = `
    <defs>
      <mask id="${maskId}" maskUnits="userSpaceOnUse">
        <rect x="0" y="0" width="390" height="844" fill="#fff"/>
        <g data-iris-star transform="translate(195 422) scale(${IRIS_OPEN_SCALE})">
          <path
            fill="#000"
            stroke="#000"
            stroke-width="7"
            stroke-linejoin="round"
            transform="translate(-50 -50)"
            d="${STAR_PATH}"
          />
        </g>
      </mask>
    </defs>
    <rect data-iris-veil x="0" y="0" width="390" height="844" fill="#000" opacity="0"/>
    <rect width="390" height="844" fill="#000" mask="url(#${maskId})"/>
  `;
  host.appendChild(svg);
  const starG = svg.querySelector('[data-iris-star]') as SVGGElement;
  const veil = svg.querySelector('[data-iris-veil]') as SVGRectElement;

  const pose = (scale: number, deg: number, alpha: number) => {
    starG.setAttribute('transform', `translate(195 422) rotate(${deg}) scale(${scale})`);
    veil.setAttribute('opacity', String(alpha));
  };

  let lock = false;
  const sleep = (ms: number) =>
    ms <= 0 ? Promise.resolve() : new Promise<void>((r) => window.setTimeout(r, ms));

  return {
    async play(swap) {
      if (lock || opts.isDead()) return;
      lock = true;
      svg.classList.remove('is-idle');
      if (opts.prefersReduce()) {
        pose(IRIS_CLOSED_SCALE, 0, 1);
        swap();
        pose(IRIS_OPEN_SCALE, 0, 0);
        svg.classList.add('is-idle');
        lock = false;
        return;
      }
      pose(IRIS_OPEN_SCALE, IRIS_SPIN_DEG, 0);
      await tween(
        0,
        1,
        IRIS_IN_MS,
        (t) => t,
        (t) => {
          const e = easeInOutQuad(t);
          pose(
            IRIS_OPEN_SCALE + (IRIS_CLOSED_SCALE - IRIS_OPEN_SCALE) * e,
            IRIS_SPIN_DEG * (1 - e),
            t,
          );
        },
        opts.isDead,
      );
      if (opts.isDead()) {
        lock = false;
        return;
      }
      pose(IRIS_CLOSED_SCALE, 0, 1);
      swap();
      await sleep(IRIS_HOLD_MS);
      if (opts.isDead()) {
        lock = false;
        return;
      }
      pose(IRIS_CLOSED_SCALE, IRIS_SPIN_DEG, 1);
      await tween(
        0,
        1,
        IRIS_OUT_MS,
        (t) => t,
        (t) => {
          const e = easeInOutQuad(t);
          pose(
            IRIS_CLOSED_SCALE + (IRIS_OPEN_SCALE - IRIS_CLOSED_SCALE) * e,
            IRIS_SPIN_DEG * (1 - e),
            1 - t,
          );
        },
        opts.isDead,
      );
      pose(IRIS_OPEN_SCALE, 0, 0);
      svg.classList.add('is-idle');
      lock = false;
    },
    dispose() {
      lock = false;
      svg.remove();
    },
  };
}

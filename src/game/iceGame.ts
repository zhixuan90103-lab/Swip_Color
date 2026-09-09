import { haptics } from '../utils/haptics';
import {
  TUNE_DEFAULT,
  TUNE_RANGE,
  layoutBoard,
  tokenPos,
  type BoardLayout,
  type BoardTune,
} from './boardLayout';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../adapt/design';
import starArt from '../assets/ui/star.png';
import { iceDirFromSwipe } from './dir';
import { FEEL2_DEFAULT } from './feel';
import { applyDir } from './iceSim';
import { attachSwipeInput } from './swipeInput';
import { createBoxMotion } from './boxMotion';
import { createCellAdd } from './cellAdd';
import { Z_LAYER, placeBoardItem } from './boardStack';
import { createDomPool } from './objectPool';
import { DIR_DELTA, ratingStars, type Cell, type Dir, type IceState } from './iceTypes';
import { LEVELS } from './levels';
import {
  STAR_CROUCH_DROP,
  STAR_CROUCH_MS,
  STAR_IDLE_PERIOD,
  STAR_IDLE_RISE,
  STAR_IDLE_STRETCH,
  STAR_IDLE_Y,
  STAR_RISE_MS,
  STAR_RISE_Y,
  STAR_TO_HUD_MS,
} from './starPickup';
import { PUSH_STEP_MS, createYouMotion, hitAmpForCells, hitDurationMs, type LookTarget } from './youMotion';

const TUNE_KEY = 'ice-board-tune-v10';
const STEP_MS = FEEL2_DEFAULT.slideMs;

function loadTune(): BoardTune {
  try {
    const raw = localStorage.getItem(TUNE_KEY);
    if (!raw) return { ...TUNE_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<BoardTune>;
    return {
      boardW: clampTune(parsed.boardW, TUNE_RANGE.boardW.min, TUNE_RANGE.boardW.max, TUNE_DEFAULT.boardW),
      boardH: clampTune(parsed.boardH, TUNE_RANGE.boardH.min, TUNE_RANGE.boardH.max, TUNE_DEFAULT.boardH),
      cell: clampTune(parsed.cell, TUNE_RANGE.cell.min, TUNE_RANGE.cell.max, TUNE_DEFAULT.cell),
      gap: clampTune(parsed.gap, TUNE_RANGE.gap.min, TUNE_RANGE.gap.max, TUNE_DEFAULT.gap),
      inset: clampTune(parsed.inset, TUNE_RANGE.inset.min, TUNE_RANGE.inset.max, TUNE_DEFAULT.inset),
      cellOpacity: clampTune(
        parsed.cellOpacity,
        TUNE_RANGE.cellOpacity.min,
        TUNE_RANGE.cellOpacity.max,
        TUNE_DEFAULT.cellOpacity,
      ),
      shadowW: clampTune(parsed.shadowW, TUNE_RANGE.shadowW.min, TUNE_RANGE.shadowW.max, TUNE_DEFAULT.shadowW),
      shadowH: clampTune(parsed.shadowH, TUNE_RANGE.shadowH.min, TUNE_RANGE.shadowH.max, TUNE_DEFAULT.shadowH),
      boxSize: clampTune(parsed.boxSize, TUNE_RANGE.boxSize.min, TUNE_RANGE.boxSize.max, TUNE_DEFAULT.boxSize),
      youSize: clampTune(parsed.youSize, TUNE_RANGE.youSize.min, TUNE_RANGE.youSize.max, TUNE_DEFAULT.youSize),
      wallSize: clampTune(parsed.wallSize, TUNE_RANGE.wallSize.min, TUNE_RANGE.wallSize.max, TUNE_DEFAULT.wallSize),
      boxX: clampTune(parsed.boxX, TUNE_RANGE.boxX.min, TUNE_RANGE.boxX.max, TUNE_DEFAULT.boxX),
      boxY: clampTune(parsed.boxY, TUNE_RANGE.boxY.min, TUNE_RANGE.boxY.max, TUNE_DEFAULT.boxY),
      youX: clampTune(parsed.youX, TUNE_RANGE.youX.min, TUNE_RANGE.youX.max, TUNE_DEFAULT.youX),
      youY: clampTune(parsed.youY, TUNE_RANGE.youY.min, TUNE_RANGE.youY.max, TUNE_DEFAULT.youY),
      wallX: clampTune(parsed.wallX, TUNE_RANGE.wallX.min, TUNE_RANGE.wallX.max, TUNE_DEFAULT.wallX),
      wallY: clampTune(parsed.wallY, TUNE_RANGE.wallY.min, TUNE_RANGE.wallY.max, TUNE_DEFAULT.wallY),
      starSize: clampTune(parsed.starSize, TUNE_RANGE.starSize.min, TUNE_RANGE.starSize.max, TUNE_DEFAULT.starSize),
      starX: clampTune(parsed.starX, TUNE_RANGE.starX.min, TUNE_RANGE.starX.max, TUNE_DEFAULT.starX),
      starY: clampTune(parsed.starY, TUNE_RANGE.starY.min, TUNE_RANGE.starY.max, TUNE_DEFAULT.starY),
      glowSize: clampTune(parsed.glowSize, TUNE_RANGE.glowSize.min, TUNE_RANGE.glowSize.max, TUNE_DEFAULT.glowSize),
      glowX: clampTune(parsed.glowX, TUNE_RANGE.glowX.min, TUNE_RANGE.glowX.max, TUNE_DEFAULT.glowX),
      glowY: clampTune(parsed.glowY, TUNE_RANGE.glowY.min, TUNE_RANGE.glowY.max, TUNE_DEFAULT.glowY),
      glowOpacity: clampTune(
        parsed.glowOpacity,
        TUNE_RANGE.glowOpacity.min,
        TUNE_RANGE.glowOpacity.max,
        TUNE_DEFAULT.glowOpacity,
      ),
      doorSize: clampTune(parsed.doorSize, TUNE_RANGE.doorSize.min, TUNE_RANGE.doorSize.max, TUNE_DEFAULT.doorSize),
    };
  } catch {
    return { ...TUNE_DEFAULT };
  }
}

function clampTune(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export type IceGameHandle = { dispose: () => void };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

export function startIceGame(opts: {
  uiRoot: HTMLElement;
  stage: HTMLElement;
}): IceGameHandle {
  let levelIndex = 0;
  let state = LEVELS[0]!.make();
  let busy = false;
  let disposed = false;
  let moveGen = 0;
  let fxGen = 0;
  let starFxWait: Promise<void>[] = [];
  let idleRaf = 0;
  type StarIdle = {
    root: HTMLElement;
    sprite: HTMLElement;
    shadow: HTMLElement;
    glow: HTMLElement | null;
    phase: number;
  };
  let idleStars: StarIdle[] = [];

  const tune = loadTune();
  let laid: BoardLayout = layoutBoard(tune, state.rows, state.cols);

  const boxMotion = createBoxMotion();

  const youMotion = createYouMotion({
    getLookTargets: (): LookTarget[] => {
      const origin = tokenPos(laid, state.player);
      const of = (cell: Cell, key: string): LookTarget => {
        const p = tokenPos(laid, cell);
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        const len = Math.hypot(dx, dy) || 1;
        const mag = Math.min(1, len / 80);
        return { key, x: (dx / len) * mag * 7, y: (dy / len) * mag * 6 };
      };
      const list = state.stars.map((s) => of(s, `s${s.r}-${s.c}`));
      list.push(of(state.door, 'door'));
      return list;
    },
  });

  const root = document.createElement('div');
  root.className = 'ice-app';
  root.innerHTML = `
    <header class="ice-hud">
      <div class="ice-title" id="ice-title">1 撞停</div>
      <div class="ice-stars" id="ice-stars" aria-hidden="true">
        <span class="hud-star" data-i="0"></span>
        <span class="hud-star" data-i="1"></span>
        <span class="hud-star" data-i="2"></span>
      </div>
      <button type="button" class="ice-restart" id="ice-restart">重开</button>
      <button type="button" class="ice-haptic" id="haptic-tap">震</button>
      <button type="button" class="ice-settings" id="ice-settings">设</button>
    </header>
    <div class="ice-board-wrap">
      <div class="ice-board-shell">
        <div class="ice-board-frame">
          <div class="ice-board" id="ice-board"></div>
        </div>
      </div>
    </div>
    <p class="ice-hint" id="ice-hint"></p>
    <div class="ice-overlay hidden" id="ice-overlay">
      <div class="ice-card">
        <p class="ice-over-kicker" id="ice-over-kicker">过关</p>
        <p class="ice-over-stars" id="ice-over-stars">★</p>
        <div class="ice-over-actions">
          <button type="button" class="ice-restart" id="ice-again">重开本关</button>
          <button type="button" class="ice-next" id="ice-next">下一关</button>
        </div>
      </div>
    </div>
    <aside class="tune-panel hidden" id="tune-panel">
      <div class="tune-head">
        <p class="tune-title">棋盘调参</p>
        <button type="button" class="tune-close" id="tune-close">关闭</button>
      </div>
      <label class="tune-row">
        <span>宽</span>
        <input id="tune-boardW" type="range" min="${TUNE_RANGE.boardW.min}" max="${TUNE_RANGE.boardW.max}" step="1" />
        <b id="tune-boardW-v"></b>
      </label>
      <label class="tune-row">
        <span>高</span>
        <input id="tune-boardH" type="range" min="${TUNE_RANGE.boardH.min}" max="${TUNE_RANGE.boardH.max}" step="1" />
        <b id="tune-boardH-v"></b>
      </label>
      <label class="tune-row">
        <span>格子</span>
        <input id="tune-cell" type="range" min="${TUNE_RANGE.cell.min}" max="${TUNE_RANGE.cell.max}" step="1" />
        <b id="tune-cell-v"></b>
      </label>
      <label class="tune-row">
        <span>缝隙</span>
        <input id="tune-gap" type="range" min="${TUNE_RANGE.gap.min}" max="${TUNE_RANGE.gap.max}" step="1" />
        <b id="tune-gap-v"></b>
      </label>
      <label class="tune-row">
        <span>框距</span>
        <input id="tune-inset" type="range" min="${TUNE_RANGE.inset.min}" max="${TUNE_RANGE.inset.max}" step="1" />
        <b id="tune-inset-v"></b>
      </label>
      <label class="tune-row">
        <span>透明</span>
        <input id="tune-cellOpacity" type="range" min="${TUNE_RANGE.cellOpacity.min}" max="${TUNE_RANGE.cellOpacity.max}" step="1" />
        <b id="tune-cellOpacity-v"></b>
      </label>
      <label class="tune-row">
        <span>影宽</span>
        <input id="tune-shadowW" type="range" min="${TUNE_RANGE.shadowW.min}" max="${TUNE_RANGE.shadowW.max}" step="1" />
        <b id="tune-shadowW-v"></b>
      </label>
      <label class="tune-row">
        <span>影高</span>
        <input id="tune-shadowH" type="range" min="${TUNE_RANGE.shadowH.min}" max="${TUNE_RANGE.shadowH.max}" step="1" />
        <b id="tune-shadowH-v"></b>
      </label>
      <label class="tune-row">
        <span>箱子</span>
        <input id="tune-boxSize" type="range" min="${TUNE_RANGE.boxSize.min}" max="${TUNE_RANGE.boxSize.max}" step="1" />
        <b id="tune-boxSize-v"></b>
      </label>
      <label class="tune-row">
        <span>角色</span>
        <input id="tune-youSize" type="range" min="${TUNE_RANGE.youSize.min}" max="${TUNE_RANGE.youSize.max}" step="1" />
        <b id="tune-youSize-v"></b>
      </label>
      <label class="tune-row">
        <span>石头</span>
        <input id="tune-wallSize" type="range" min="${TUNE_RANGE.wallSize.min}" max="${TUNE_RANGE.wallSize.max}" step="1" />
        <b id="tune-wallSize-v"></b>
      </label>
      <label class="tune-row">
        <span>箱X</span>
        <input id="tune-boxX" type="range" min="${TUNE_RANGE.boxX.min}" max="${TUNE_RANGE.boxX.max}" step="1" />
        <b id="tune-boxX-v"></b>
      </label>
      <label class="tune-row">
        <span>箱Y</span>
        <input id="tune-boxY" type="range" min="${TUNE_RANGE.boxY.min}" max="${TUNE_RANGE.boxY.max}" step="1" />
        <b id="tune-boxY-v"></b>
      </label>
      <label class="tune-row">
        <span>角X</span>
        <input id="tune-youX" type="range" min="${TUNE_RANGE.youX.min}" max="${TUNE_RANGE.youX.max}" step="1" />
        <b id="tune-youX-v"></b>
      </label>
      <label class="tune-row">
        <span>角Y</span>
        <input id="tune-youY" type="range" min="${TUNE_RANGE.youY.min}" max="${TUNE_RANGE.youY.max}" step="1" />
        <b id="tune-youY-v"></b>
      </label>
      <label class="tune-row">
        <span>石X</span>
        <input id="tune-wallX" type="range" min="${TUNE_RANGE.wallX.min}" max="${TUNE_RANGE.wallX.max}" step="1" />
        <b id="tune-wallX-v"></b>
      </label>
      <label class="tune-row">
        <span>石Y</span>
        <input id="tune-wallY" type="range" min="${TUNE_RANGE.wallY.min}" max="${TUNE_RANGE.wallY.max}" step="1" />
        <b id="tune-wallY-v"></b>
      </label>
      <label class="tune-row">
        <span>星星</span>
        <input id="tune-starSize" type="range" min="${TUNE_RANGE.starSize.min}" max="${TUNE_RANGE.starSize.max}" step="1" />
        <b id="tune-starSize-v"></b>
      </label>
      <label class="tune-row">
        <span>星X</span>
        <input id="tune-starX" type="range" min="${TUNE_RANGE.starX.min}" max="${TUNE_RANGE.starX.max}" step="1" />
        <b id="tune-starX-v"></b>
      </label>
      <label class="tune-row">
        <span>星Y</span>
        <input id="tune-starY" type="range" min="${TUNE_RANGE.starY.min}" max="${TUNE_RANGE.starY.max}" step="1" />
        <b id="tune-starY-v"></b>
      </label>
      <label class="tune-row">
        <span>光大小</span>
        <input id="tune-glowSize" type="range" min="${TUNE_RANGE.glowSize.min}" max="${TUNE_RANGE.glowSize.max}" step="1" />
        <b id="tune-glowSize-v"></b>
      </label>
      <label class="tune-row">
        <span>光X</span>
        <input id="tune-glowX" type="range" min="${TUNE_RANGE.glowX.min}" max="${TUNE_RANGE.glowX.max}" step="1" />
        <b id="tune-glowX-v"></b>
      </label>
      <label class="tune-row">
        <span>光Y</span>
        <input id="tune-glowY" type="range" min="${TUNE_RANGE.glowY.min}" max="${TUNE_RANGE.glowY.max}" step="1" />
        <b id="tune-glowY-v"></b>
      </label>
      <label class="tune-row">
        <span>光透明</span>
        <input id="tune-glowOpacity" type="range" min="${TUNE_RANGE.glowOpacity.min}" max="${TUNE_RANGE.glowOpacity.max}" step="1" />
        <b id="tune-glowOpacity-v"></b>
      </label>
      <label class="tune-row">
        <span>终点</span>
        <input id="tune-doorSize" type="range" min="${TUNE_RANGE.doorSize.min}" max="${TUNE_RANGE.doorSize.max}" step="1" />
        <b id="tune-doorSize-v"></b>
      </label>
      <p class="tune-hint">X右正 Y下正，相对格子中心</p>
      <button type="button" class="tune-reset" id="tune-reset">恢复默认</button>
    </aside>
  `;
  root.style.backgroundImage = `url(${import.meta.env.BASE_URL}ui/table-bg.png)`;
  opts.uiRoot.replaceChildren(root);

  const board = root.querySelector('#ice-board') as HTMLElement;

  const makeEl = (className: string, html?: string): HTMLElement => {
    const n = document.createElement('div');
    n.className = `ice-piece ${className}`;
    if (html) n.innerHTML = html;
    return n;
  };

  const cellPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-cell', '<span class="ice-cell-tile"></span><span class="ice-cell-add"></span>'),
    reset(n) {
      n.className = 'ice-piece ice-cell';
      n.removeAttribute('data-cell');
      n.removeAttribute('style');
      const add = n.querySelector('.ice-cell-add') as HTMLElement | null;
      if (add) {
        add.style.transition = 'none';
        add.style.opacity = '0';
      }
    },
  });
  const wallPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-cell is-wall'),
    reset(n) {
      n.className = 'ice-piece ice-cell is-wall';
      n.removeAttribute('style');
    },
  });
  const glowPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-star-glow'),
    reset(n) {
      n.className = 'ice-piece ice-star-glow';
      n.removeAttribute('data-star-glow');
      n.removeAttribute('style');
      delete n.dataset.scale;
    },
  });
  const starPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-star', '<span class="ice-star-shadow"></span><span class="ice-star-sprite"></span>'),
    reset(n) {
      n.className = 'ice-piece ice-star';
      n.removeAttribute('data-star');
      n.removeAttribute('data-phase');
      n.removeAttribute('style');
      const sprite = n.querySelector('.ice-star-sprite') as HTMLElement | null;
      if (sprite) sprite.style.transform = '';
    },
  });
  const doorPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-door'),
    reset(n) {
      n.className = 'ice-piece ice-door';
      n.removeAttribute('style');
    },
  });
  const boxPool = createDomPool({
    parent: board,
    create: () => makeEl('ice-box', '<span class="box-rig"></span>'),
    reset(n) {
      n.removeAttribute('id');
      n.removeAttribute('style');
      n.style.removeProperty('--box-hit-x');
      n.style.removeProperty('--box-hit-y');
    },
  });
  const flyPool = createDomPool({
    parent: opts.stage,
    create: () => {
      const fly = makeEl('ice-star-fly');
      const base = document.createElement('span');
      base.className = 'ice-star-fly-base';
      base.style.backgroundImage = `url(${starArt})`;
      const add = document.createElement('span');
      add.className = 'ice-star-fly-add';
      add.style.backgroundImage = `url(${starArt})`;
      fly.append(base, add);
      return fly;
    },
    reset(n) {
      n.className = 'ice-piece ice-star-fly';
      n.removeAttribute('style');
      const add = n.querySelector('.ice-star-fly-add') as HTMLElement | null;
      if (add) add.style.opacity = '0';
    },
  });
  const burstPool = createDomPool({
    parent: opts.stage,
    create: () => makeEl('ice-star-burst'),
    reset(n) {
      n.className = 'ice-piece ice-star-burst';
      n.removeAttribute('style');
    },
  });

  const youEl = makeEl(
    'ice-you',
    '<span class="you-shadow"></span><span class="you-rig"><span class="you-body"></span><span class="you-eye"><span class="you-pupil"></span></span></span>',
  );
  youEl.id = 'ice-you';
  board.appendChild(youEl);

  const cellAdd = createCellAdd({
    getBoard: () => board,
    getLaid: () => laid,
    getYou: () => youEl,
    getBaseStepMs: () => STEP_MS,
    prefersReduce: () => prefersReduceMotion(),
  });
  const starsEl = root.querySelector('#ice-stars') as HTMLElement;
  const titleEl = root.querySelector('#ice-title') as HTMLElement;
  const hintEl = root.querySelector('#ice-hint') as HTMLElement;
  const overlay = root.querySelector('#ice-overlay') as HTMLElement;
  const overStars = root.querySelector('#ice-over-stars') as HTMLElement;
  const overKicker = root.querySelector('#ice-over-kicker') as HTMLElement;
  const nextBtn = root.querySelector('#ice-next') as HTMLButtonElement;

  function pin(el: HTMLElement, c: Cell, layer: (typeof Z_LAYER)[keyof typeof Z_LAYER]): void {
    const p = tokenPos(laid, c);
    placeBoardItem(el, p.x, p.y, c.r, layer);
  }

  function paintStatic(s: IceState): void {
    fxGen += 1;
    starFxWait = [];
    flyPool.releaseAll();
    burstPool.releaseAll();
    cellPool.releaseAll();
    wallPool.releaseAll();
    glowPool.releaseAll();
    starPool.releaseAll();
    doorPool.releaseAll();
    boxPool.releaseAll();
    laid = layoutBoard(tune, s.rows, s.cols);
    applyTuneCss();
    for (const cell of s.open) {
      const n = cellPool.acquire();
      n.className = `ice-piece ice-cell ${(cell.r + cell.c) % 2 === 0 ? 'is-ice-a' : 'is-ice-b'}`;
      n.setAttribute('data-cell', `${cell.r}-${cell.c}`);
      pin(n, cell, Z_LAYER.ice);
    }
    for (const cell of s.walls) {
      pin(wallPool.acquire(), cell, Z_LAYER.wall);
    }
    for (const t of s.stars) {
      const id = `${t.r}-${t.c}`;
      const glow = glowPool.acquire();
      glow.setAttribute('data-star-glow', id);
      pin(glow, t, Z_LAYER.glow);
      const star = starPool.acquire();
      star.setAttribute('data-star', id);
      star.setAttribute('data-phase', String(((t.r * 3 + t.c) % 7) / 7));
      pin(star, t, Z_LAYER.star);
    }
    {
      const glow = glowPool.acquire();
      glow.setAttribute('data-star-glow', 'door');
      pin(glow, s.door, Z_LAYER.glow);
      pin(doorPool.acquire(), s.door, Z_LAYER.door);
      const star = starPool.acquire();
      star.classList.add('ice-star-door');
      star.setAttribute('data-star', 'door');
      star.setAttribute('data-phase', String(((s.door.r * 3 + s.door.c) % 7) / 7));
      pin(star, s.door, Z_LAYER.star);
    }
    s.boxes.forEach((_, i) => {
      const n = boxPool.acquire();
      n.id = `ice-box-${i}`;
    });
    if (youEl.parentElement !== board) board.appendChild(youEl);
    board.style.width = `${laid.gridW}px`;
    board.style.height = `${laid.gridH}px`;
    board.style.left = `${laid.originX}px`;
    board.style.top = `${laid.originY}px`;
    boxMotion.abort();
    cellAdd.reset();
    bindStarIdle();
    youMotion.bind(youEl, youEl.querySelector('.you-rig'), youEl.querySelector('.you-eye'), youEl.querySelector('.you-pupil'));
    placeTokens(s);
    const def = LEVELS[levelIndex]!;
    titleEl.textContent = `${def.id} ${def.title}`;
    hintEl.textContent = def.hint;
    starsEl.querySelectorAll('.hud-star').forEach((el, i) => {
      el.classList.toggle('is-on', i < s.collected);
    });
    fitBoard();
  }

  function fitBoard(): void {
    const frame = board.parentElement as HTMLElement | null;
    const shell = frame?.parentElement as HTMLElement | null;
    const wrap = shell?.parentElement as HTMLElement | null;
    if (!shell || !wrap) return;
    const maxW = Math.max(wrap.clientWidth, 1);
    const maxH = Math.max(wrap.clientHeight, 1);
    const scale = Math.min(1, maxW / laid.boardW, maxH / laid.boardH);
    shell.style.transform = `scale(${scale})`;
  }

  function placeAt(el: HTMLElement, c: Cell): void {
    const p = tokenPos(laid, c);
    placeBoardItem(el, p.x, p.y, c.r, Z_LAYER.actor);
  }

  function placeTokens(s: IceState): void {
    const you = board.querySelector('#ice-you') as HTMLElement | null;
    if (you) placeAt(you, s.player);
    cellAdd.hold(s.player);
    s.boxes.forEach((b, i) => {
      const el = board.querySelector(`#ice-box-${i}`) as HTMLElement | null;
      if (!el) return;
      placeAt(el, b);
    });
  }

  function starIdleHeight(u: number): number {
    if (u < STAR_IDLE_RISE) {
      const x = u / STAR_IDLE_RISE;
      return 0.5 - 0.5 * Math.cos(Math.PI * x);
    }
    const x = (u - STAR_IDLE_RISE) / (1 - STAR_IDLE_RISE);
    return 0.5 + 0.5 * Math.cos(Math.PI * x);
  }

  function starIdleSpeed(u: number): number {
    if (u < STAR_IDLE_RISE) return Math.sin(Math.PI * (u / STAR_IDLE_RISE));
    return Math.sin(Math.PI * ((u - STAR_IDLE_RISE) / (1 - STAR_IDLE_RISE)));
  }

  function bindStarIdle(): void {
    idleStars = [];
    board.querySelectorAll('.ice-star:not(.is-pooled)').forEach((el) => {
      const sprite = el.querySelector('.ice-star-sprite') as HTMLElement | null;
      const shadow = el.querySelector('.ice-star-shadow') as HTMLElement | null;
      if (!sprite || !shadow) return;
      const id = el.getAttribute('data-star');
      idleStars.push({
        root: el as HTMLElement,
        sprite,
        shadow,
        glow: id ? (board.querySelector(`[data-star-glow="${id}"]`) as HTMLElement | null) : null,
        phase: Number(el.getAttribute('data-phase')) || 0,
      });
    });
    if (!idleRaf) idleRaf = requestAnimationFrame(tickStarIdle);
  }

  function tickStarIdle(now: number): void {
    if (disposed) return;
    idleRaf = requestAnimationFrame(tickStarIdle);
    cellAdd.tick();
    if (prefersReduceMotion()) return;
    youMotion.tick(now);
    boxMotion.tick(now);
    const cycle = now / 1000 / STAR_IDLE_PERIOD;
    const glowBase = tune.glowOpacity / 100;
    for (const star of idleStars) {
      if (star.root.classList.contains('gone')) continue;
      const u = (cycle + star.phase) % 1;
      const h = starIdleHeight(u);
      const speed = starIdleSpeed(u);
      const sy = 1 + STAR_IDLE_STRETCH * speed - STAR_IDLE_STRETCH * 0.85 * h;
      const sx = 1 / sy;
      star.sprite.style.transform = `translateY(${(-STAR_IDLE_Y * h).toFixed(2)}px) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
      if (star.glow && !star.glow.classList.contains('is-fading')) {
        const g = 1.28 - 0.58 * h;
        star.glow.style.transform =
          `translate(calc(-50% + var(--ice-glow-x)), calc(-50% + var(--ice-glow-y))) scale(${g.toFixed(3)})`;
        star.glow.style.opacity = (Math.max(0.25, glowBase) * (0.92 - 0.22 * h)).toFixed(3);
        star.glow.dataset.scale = g.toFixed(3);
      }
    }
  }

  function starKey(at: Cell): string {
    if (at.r === state.door.r && at.c === state.door.c) {
      const onDoor = state.stars.some((s) => s.r === at.r && s.c === at.c);
      if (!onDoor) return 'door';
    }
    return `${at.r}-${at.c}`;
  }

  function hideStar(at: Cell): void {
    board.querySelector(`[data-star="${starKey(at)}"]`)?.classList.add('gone');
  }

  function glowEl(at: Cell): HTMLElement | null {
    return board.querySelector(`[data-star-glow="${starKey(at)}"]`) as HTMLElement | null;
  }

  function prefersReduceMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pointOnStage(el: HTMLElement): { x: number; y: number; w: number; h: number } {
    const s = opts.stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const sw = Math.max(s.width, 1);
    const sh = Math.max(s.height, 1);
    return {
      x: ((r.left + r.width / 2 - s.left) / sw) * DESIGN_WIDTH,
      y: ((r.top + r.height / 2 - s.top) / sh) * DESIGN_HEIGHT,
      w: (r.width / sw) * DESIGN_WIDTH,
      h: (r.height / sh) * DESIGN_HEIGHT,
    };
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInQuart(t: number): number {
    return t * t * t * t;
  }

  function quad(a: number, b: number, c: number, t: number): number {
    const u = 1 - t;
    return u * u * a + 2 * u * t * b + t * t * c;
  }

  function clamp01(n: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, n));
  }

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function lerpAngle(a: number, b: number, t: number): number {
    let d = b - a;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return a + d * t;
  }



  function burstHudStar(hud: HTMLElement): void {
    if (prefersReduceMotion()) return;
    const p = pointOnStage(hud);
    const size = Math.max(p.w, p.h, 22);
    const burst = burstPool.acquire();
    burst.style.width = `${size}px`;
    burst.style.height = `${size}px`;
    burst.style.backgroundImage = `url(${starArt})`;
    const gen = fxGen;
    const t0 = performance.now();
    const dur = 360;
    const done = () => burstPool.release(burst);
    const tick = (now: number) => {
      if (disposed || gen !== fxGen) {
        done();
        return;
      }
      const t = Math.min(1, (now - t0) / dur);
      const e = easeOutCubic(t);
      const s = lerp(1, 2.4, e);
      burst.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2}px) scale(${s})`;
      burst.style.opacity = (1 - e).toFixed(3);
      if (t < 1) requestAnimationFrame(tick);
      else done();
    };
    burst.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2}px) scale(1)`;
    burst.style.opacity = '1';
    requestAnimationFrame(tick);
  }

  function lightHudStar(index: number): void {
    const hud = starsEl.querySelector(`.hud-star[data-i="${index}"]`) as HTMLElement | null;
    if (!hud) return;
    hud.classList.add('is-on');
    hud.classList.remove('is-pop');
    void hud.offsetWidth;
    hud.classList.add('is-pop');
    burstHudStar(hud);
  }

  function collectStarFx(at: Cell, hudIndex: number): Promise<void> {
    const id = starKey(at);
    const star = board.querySelector(`[data-star="${id}"]`) as HTMLElement | null;
    const glow = glowEl(at);
    const glowScale0 = Number(glow?.dataset.scale) || 1;
    const glowBase = Math.max(0.25, tune.glowOpacity / 100);
    const hud = starsEl.querySelector(`.hud-star[data-i="${hudIndex}"]`) as HTMLElement | null;
    if (!star || prefersReduceMotion()) {
      hideStar(at);
      glow?.classList.add('gone');
      lightHudStar(hudIndex);
      return Promise.resolve();
    }

    const sprite = (star.querySelector('.ice-star-sprite') as HTMLElement | null) ?? star;
    const from = pointOnStage(sprite);
    const to = hud ? pointOnStage(hud) : { x: DESIGN_WIDTH - 72, y: 48, w: 22, h: 22 };
    const size = Math.max(from.w, from.h, tune.starSize * 0.5, 28);
    const gen = fxGen;
    const fly = flyPool.acquire();
    fly.style.width = `${size}px`;
    fly.style.height = `${size}px`;
    fly.style.left = '0';
    fly.style.top = '0';
    const flyAdd = fly.querySelector('.ice-star-fly-add') as HTMLElement;
    hideStar(at);

    const endScale = Math.max(0.42, to.w / size);
    const t0 = performance.now();
    let lastX = from.x;
    let lastY = from.y;
    let headHoldX = from.x;
    let headHoldY = from.y;
    let hoverX = from.x;
    let hoverY = from.y;
    let lastSx = 1;
    let lastSy = 1;
    let lastRot = 0;
    let hudFromSx = 1;
    let hudFromSy = 1;
    let hudFromRot = 0;
    let hudFromX = from.x;
    let hudFromY = from.y;
    let hudPoseCaptured = false;

    const place = (x: number, y: number, sx: number, sy: number, rotDeg: number, a: number, add: number) => {
      fly.style.transformOrigin = '50% 50%';
      fly.style.transform =
        `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${rotDeg}deg) scale(${sx}, ${sy})`;
      fly.style.opacity = String(a);
      flyAdd.style.opacity = String(add);
      lastX = x;
      lastY = y;
      lastSx = sx;
      lastSy = sy;
      lastRot = rotDeg;
    };

    place(from.x, from.y, 1, 1, 0, 1, 0);

    return new Promise((resolve) => {
    const done = () => {
      flyPool.release(fly);
      lightHudStar(hudIndex);
      resolve();
    };
    const tick = (now: number) => {
      if (disposed || gen !== fxGen) {
        flyPool.release(fly);
        resolve();
        return;
      }
      const elapsed = now - t0;
      if (elapsed <= STAR_RISE_MS) {
        const t = Math.min(1, elapsed / STAR_RISE_MS);
        const e = easeOutCubic(t);
        const x = from.x;
        const y = lerp(from.y, from.y - STAR_RISE_Y, e);
        const sy = 1 + 0.34 * Math.sin(Math.PI * t);
        const sx = 1 / sy;
        place(x, y, sx, sy, 0, 1, 0.3 * e);
        headHoldX = x;
        headHoldY = from.y - STAR_RISE_Y;
        hoverX = x;
        hoverY = y;
        requestAnimationFrame(tick);
        return;
      }

      const afterCrouch = STAR_RISE_MS + STAR_CROUCH_MS;
      if (elapsed <= afterCrouch) {
        const t = Math.min(1, (elapsed - STAR_RISE_MS) / STAR_CROUCH_MS);
        const e = easeOutCubic(t);
        const x = headHoldX;
        const y = lerp(headHoldY, headHoldY + STAR_CROUCH_DROP, e);
        const sy = lerp(1, 0.74, e);
        const sx = 1 / sy;
        const flicker = 0.22 + 0.08 * Math.sin(t * Math.PI * 6);
        place(x, y, sx, sy, 0, 1, flicker);
        hoverX = x;
        hoverY = y;
        requestAnimationFrame(tick);
        return;
      }

      if (!hudPoseCaptured) {
        hudFromSx = lastSx;
        hudFromSy = lastSy;
        hudFromRot = lastRot;
        hudFromX = hoverX;
        hudFromY = hoverY;
        hudPoseCaptured = true;
      }

      const u = Math.min(1, (elapsed - afterCrouch) / STAR_TO_HUD_MS);
      const e = easeInQuart(u);
      const p1x = (hudFromX + to.x) * 0.5 + (hudFromX < to.x ? -10 : 10);
      const p1y = Math.min(hudFromY, to.y) - 28;
      const x = quad(hudFromX, p1x, to.x, e);
      const y = quad(hudFromY, p1y, to.y, e);
      const dx = x - lastX;
      const dy = y - lastY;
      const spd = Math.hypot(dx, dy);
      const flightRot = spd > 0.35 ? (Math.atan2(dy, dx) * 180) / Math.PI : hudFromRot;
      const rot = lerpAngle(hudFromRot, flightRot, easeOutCubic(Math.min(1, u / 0.28)));
      const stretch = clamp01(1 + spd * 0.045, 1, 1.42);
      const body = lerp(Math.sqrt(hudFromSx * hudFromSy), endScale, e);
      const shrink = lerp(1, 0.22, e);
      const sxFly = stretch * body;
      const syFly = (1 / stretch) * body;
      const blend = easeOutCubic(Math.min(1, u / 0.22));
      const sx = lerp(hudFromSx, sxFly, blend) * shrink;
      const sy = lerp(hudFromSy, syFly, blend) * shrink;
      const a = 1 - e;
      place(x, y, sx, sy, rot, a, lerp(0.3, 0, e));
      if (glow) {
        glow.classList.add('is-fading');
        const gf = easeOutCubic(Math.min(1, u / 0.28));
        const gs = lerp(glowScale0, glowScale0 * 0.72, gf);
        glow.style.transform =
          `translate(calc(-50% + var(--ice-glow-x)), calc(-50% + var(--ice-glow-y))) scale(${gs.toFixed(3)})`;
        glow.style.opacity = (glowBase * (1 - gf)).toFixed(3);
        if (gf >= 1) glow.classList.add('gone');
      }
      if (u < 1) {
        requestAnimationFrame(tick);
        return;
      }
      done();
    };
    requestAnimationFrame(tick);
    });
  }

  function applyTuneCss(): void {
    root.style.setProperty('--ice-board-w', `${laid.boardW}px`);
    root.style.setProperty('--ice-board-h', `${laid.boardH}px`);
    root.style.setProperty('--ice-cell', `${tune.cell}px`);
    root.style.setProperty('--ice-gap', `${tune.gap}px`);
    root.style.setProperty('--ice-inset', `${tune.inset}px`);
    root.style.setProperty('--ice-tile-opacity', String(tune.cellOpacity / 100));
    const sw = tune.shadowW * (laid.boardW / tune.boardW);
    const sh = tune.shadowH * (laid.boardH / tune.boardH);
    root.style.setProperty('--ice-shadow-w', `${sw}px`);
    root.style.setProperty('--ice-shadow-h', `${sh}px`);
    root.style.setProperty('--ice-box', `${tune.boxSize}px`);
    root.style.setProperty('--ice-you', `${tune.youSize}px`);
    root.style.setProperty('--ice-wall', `${tune.wallSize}px`);
    root.style.setProperty('--ice-box-x', `${tune.boxX}px`);
    root.style.setProperty('--ice-box-y', `${tune.boxY}px`);
    root.style.setProperty('--ice-you-x', `${tune.youX}px`);
    root.style.setProperty('--ice-you-y', `${tune.youY}px`);
    root.style.setProperty('--ice-wall-x', `${tune.wallX}px`);
    root.style.setProperty('--ice-wall-y', `${tune.wallY}px`);
    root.style.setProperty('--ice-star', `${tune.starSize}px`);
    root.style.setProperty('--ice-star-x', `${tune.starX}px`);
    root.style.setProperty('--ice-star-y', `${tune.starY}px`);
    root.style.setProperty('--ice-glow', `${tune.glowSize}px`);
    root.style.setProperty('--ice-glow-x', `${tune.glowX}px`);
    root.style.setProperty('--ice-glow-y', `${tune.glowY}px`);
    root.style.setProperty('--ice-glow-opacity', String(tune.glowOpacity / 100));
    root.style.setProperty('--ice-door', `${tune.doorSize}px`);
  }

  function syncTuneUi(): void {
    ([
      'boardW',
      'boardH',
      'cell',
      'gap',
      'inset',
      'cellOpacity',
      'shadowW',
      'shadowH',
      'boxSize',
      'youSize',
      'wallSize',
      'boxX',
      'boxY',
      'youX',
      'youY',
      'wallX',
      'wallY',
      'starSize',
      'starX',
      'starY',
      'glowSize',
      'glowX',
      'glowY',
      'glowOpacity',
      'doorSize',
    ] as const).forEach((key) => {
      const input = root.querySelector(`#tune-${key}`) as HTMLInputElement;
      input.value = String(tune[key]);
      root.querySelector(`#tune-${key}-v`)!.textContent = String(tune[key]);
    });
  }

  function commitTune(): void {
    applyTuneCss();
    syncTuneUi();
    localStorage.setItem(TUNE_KEY, JSON.stringify(tune));
    paintStatic(state);
  }

  applyTuneCss();
  syncTuneUi();
  paintStatic(state);

  const onTuneInput = (key: keyof BoardTune) => (e: Event) => {
    const el = e.target as HTMLInputElement;
    tune[key] = Number(el.value);
    if (
      key === 'cellOpacity' ||
      key === 'shadowW' ||
      key === 'shadowH' ||
      key === 'boxSize' ||
      key === 'youSize' ||
      key === 'wallSize' ||
      key === 'boxX' ||
      key === 'boxY' ||
      key === 'youX' ||
      key === 'youY' ||
      key === 'wallX' ||
      key === 'wallY' ||
      key === 'starSize' ||
      key === 'starX' ||
      key === 'starY' ||
      key === 'glowSize' ||
      key === 'glowX' ||
      key === 'glowY' ||
      key === 'glowOpacity' ||
      key === 'doorSize'
    ) {
      applyTuneCss();
      syncTuneUi();
      localStorage.setItem(TUNE_KEY, JSON.stringify(tune));
      return;
    }
    commitTune();
  };
  root.querySelector('#tune-boardW')!.addEventListener('input', onTuneInput('boardW'));
  root.querySelector('#tune-boardH')!.addEventListener('input', onTuneInput('boardH'));
  root.querySelector('#tune-cell')!.addEventListener('input', onTuneInput('cell'));
  root.querySelector('#tune-gap')!.addEventListener('input', onTuneInput('gap'));
  root.querySelector('#tune-inset')!.addEventListener('input', onTuneInput('inset'));
  root.querySelector('#tune-cellOpacity')!.addEventListener('input', onTuneInput('cellOpacity'));
  root.querySelector('#tune-shadowW')!.addEventListener('input', onTuneInput('shadowW'));
  root.querySelector('#tune-shadowH')!.addEventListener('input', onTuneInput('shadowH'));
  root.querySelector('#tune-boxSize')!.addEventListener('input', onTuneInput('boxSize'));
  root.querySelector('#tune-youSize')!.addEventListener('input', onTuneInput('youSize'));
  root.querySelector('#tune-wallSize')!.addEventListener('input', onTuneInput('wallSize'));
  root.querySelector('#tune-boxX')!.addEventListener('input', onTuneInput('boxX'));
  root.querySelector('#tune-boxY')!.addEventListener('input', onTuneInput('boxY'));
  root.querySelector('#tune-youX')!.addEventListener('input', onTuneInput('youX'));
  root.querySelector('#tune-youY')!.addEventListener('input', onTuneInput('youY'));
  root.querySelector('#tune-wallX')!.addEventListener('input', onTuneInput('wallX'));
  root.querySelector('#tune-wallY')!.addEventListener('input', onTuneInput('wallY'));
  root.querySelector('#tune-starSize')!.addEventListener('input', onTuneInput('starSize'));
  root.querySelector('#tune-starX')!.addEventListener('input', onTuneInput('starX'));
  root.querySelector('#tune-starY')!.addEventListener('input', onTuneInput('starY'));
  root.querySelector('#tune-glowSize')!.addEventListener('input', onTuneInput('glowSize'));
  root.querySelector('#tune-glowX')!.addEventListener('input', onTuneInput('glowX'));
  root.querySelector('#tune-glowY')!.addEventListener('input', onTuneInput('glowY'));
  root.querySelector('#tune-glowOpacity')!.addEventListener('input', onTuneInput('glowOpacity'));
  root.querySelector('#tune-doorSize')!.addEventListener('input', onTuneInput('doorSize'));
  root.querySelector('#tune-reset')!.addEventListener('click', (e) => {
    e.stopPropagation();
    Object.assign(tune, TUNE_DEFAULT);
    commitTune();
  });
  const tunePanel = root.querySelector('#tune-panel') as HTMLElement;
  const blockSwipe = (e: Event) => e.stopPropagation();
  tunePanel.addEventListener('pointerdown', blockSwipe);
  tunePanel.addEventListener('pointermove', blockSwipe);
  tunePanel.addEventListener('pointerup', blockSwipe);
  const toggleTune = (e: Event) => {
    e.stopPropagation();
    tunePanel.classList.toggle('hidden');
  };
  root.querySelector('#ice-settings')!.addEventListener('click', toggleTune);
  root.querySelector('#tune-close')!.addEventListener('click', toggleTune);

  const wrap = root.querySelector('.ice-board-wrap') as HTMLElement;
  const ro = new ResizeObserver(() => fitBoard());
  ro.observe(wrap);

  const loadLevel = (index: number) => {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    busy = false;
    state = LEVELS[levelIndex]!.make();
    overlay.classList.add('hidden');
    paintStatic(state);
  };

  const restart = () => {
    if (disposed) return;
    loadLevel(levelIndex);
  };

  const goNext = () => {
    if (disposed) return;
    if (levelIndex >= LEVELS.length - 1) {
      loadLevel(0);
      return;
    }
    loadLevel(levelIndex + 1);
  };

  root.querySelector('#ice-restart')!.addEventListener('click', (e) => {
    e.stopPropagation();
    restart();
  });
  root.querySelector('#ice-again')!.addEventListener('click', (e) => {
    e.stopPropagation();
    restart();
  });
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    goNext();
  });

  async function playDir(dir: Dir): Promise<void> {
    if (busy || state.won || disposed) return;
    const result = applyDir(state, dir);
    const gen = ++moveGen;
    busy = true;
    boxMotion.abort();
    youMotion.startSlide(dir, performance.now());
    const you = board.querySelector('#ice-you') as HTMLElement;
    const boxEl =
      result.pushedBox != null
        ? (board.querySelector(`#ice-box-${result.pushedBox}`) as HTMLElement | null)
        : null;
    const picked = result.starsPicked.slice();
    let pi = 0;
    const stepMs = result.kind === 'push' ? PUSH_STEP_MS : STEP_MS;
    cellAdd.setStepMs(stepMs);
    const slideEase = `left ${stepMs}ms linear, top ${stepMs}ms linear`;
    you.style.transition = slideEase;
    if (boxEl) boxEl.style.transition = slideEase;

    const steps = result.playerPath.length;
    for (let i = 1; i < steps; i++) {
      const prev = result.playerPath[i - 1]!;
      const next = result.playerPath[i]!;
      cellAdd.beginStep(prev, next, performance.now(), stepMs);
      placeAt(you, next);
      if (boxEl && result.boxPath && result.boxPath[i]) {
        placeAt(boxEl, result.boxPath[i]!);
      }
      const here = result.playerPath[i]!;
      if (picked[pi] && picked[pi]!.r === here.r && picked[pi]!.c === here.c) {
        starFxWait.push(collectStarFx(picked[pi]!, state.collected + pi));
        pi += 1;
      }
      if (here.r === state.door.r && here.c === state.door.c) {
        starFxWait.push(collectStarFx(state.door, 2));
      }
      await sleep(stepMs);
      if (disposed || gen !== moveGen) {
        youMotion.abort();
        boxMotion.abort();
        return;
      }
    }

    cellAdd.endTrack();
    state = result.state;
    placeTokens(state);
    busy = false;
    swipe.onMoveSettled();

    const cells = Math.max(0, steps - 1);
    const now = performance.now();
    if (gen !== moveGen) return;
    youMotion.startHit(dir, now, cells);
    youMotion.endSlide();
    const stop = result.playerPath[steps - 1]!;
    const face = DIR_DELTA[dir];
    const br = stop.r + face.r;
    const bc = stop.c + face.c;
    let boxI = result.state.boxes.findIndex((b) => b.r === br && b.c === bc);
    if (boxI < 0 && result.pushedBox != null) boxI = result.pushedBox;
    const hitBox = boxI >= 0 ? (board.querySelector(`#ice-box-${boxI}`) as HTMLElement | null) : null;
    if (hitBox) boxMotion.startHit(hitBox, dir, now, hitAmpForCells(cells));

    if (state.won) {
      await Promise.all(starFxWait);
      starFxWait = [];
      if (disposed || gen !== moveGen) return;
      await sleep(prefersReduceMotion() ? 0 : 280);
      if (disposed || gen !== moveGen) return;
      const n = ratingStars(state);
      const last = levelIndex >= LEVELS.length - 1;
      overKicker.textContent = last ? '全部通关' : `第 ${LEVELS[levelIndex]!.id} 关`;
      overStars.textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
      nextBtn.textContent = last ? '再来一遍' : '下一关';
      overlay.classList.remove('hidden');
      void haptics.notification('success');
    } else {
      void haptics.impact(result.kind === 'push' ? 'medium' : 'light');
      await sleep(hitDurationMs(cells));
      if (gen !== moveGen) return;
      youMotion.endSlide();
    }
  }

  root.querySelector('#haptic-tap')!.addEventListener('click', (e) => {
    e.stopPropagation();
    void haptics.impact('medium');
  });

  const swipe = attachSwipeInput({
    target: opts.stage,
    getFeel: () => FEEL2_DEFAULT,
    isBlocked: () => busy || state.won || disposed,
    getLegal: () => (d) => applyDir(state, iceDirFromSwipe(d)).kind !== 'stuck',
    onMove: (d) => {
      void playDir(iceDirFromSwipe(d));
    },
  });

  return {
    dispose() {
      disposed = true;
      youMotion.abort();
      boxMotion.abort();
      flyPool.releaseAll();
      burstPool.releaseAll();
      cellPool.releaseAll();
      wallPool.releaseAll();
      glowPool.releaseAll();
      starPool.releaseAll();
      doorPool.releaseAll();
      boxPool.releaseAll();
      if (idleRaf) cancelAnimationFrame(idleRaf);
      idleRaf = 0;
      ro.disconnect();
      swipe.dispose();
      root.remove();
    },
  };
}

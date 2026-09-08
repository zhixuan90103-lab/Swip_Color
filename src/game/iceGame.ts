import { haptics } from '../utils/haptics';
import {
  TUNE_DEFAULT,
  TUNE_RANGE,
  layoutBoard,
  tokenPos,
  type BoardLayout,
  type BoardTune,
} from './boardLayout';
import { iceDirFromSwipe } from './dir';
import { FEEL2_DEFAULT } from './feel';
import { applyDir } from './iceSim';
import { attachSwipeInput } from './swipeInput';
import { cellKey, ratingStars, type Cell, type Dir, type IceState } from './iceTypes';
import { LEVELS } from './levels';

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
  const tune = loadTune();
  let laid: BoardLayout = layoutBoard(tune, state.rows, state.cols);

  const root = document.createElement('div');
  root.className = 'ice-app';
  root.innerHTML = `
    <header class="ice-hud">
      <div class="ice-title" id="ice-title">1 撞停</div>
      <div class="ice-stars" id="ice-stars" aria-hidden="true">
        <span class="hud-star" data-i="0"></span>
        <span class="hud-star" data-i="1"></span>
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
  const starsEl = root.querySelector('#ice-stars') as HTMLElement;
  const titleEl = root.querySelector('#ice-title') as HTMLElement;
  const hintEl = root.querySelector('#ice-hint') as HTMLElement;
  const overlay = root.querySelector('#ice-overlay') as HTMLElement;
  const overStars = root.querySelector('#ice-over-stars') as HTMLElement;
  const overKicker = root.querySelector('#ice-over-kicker') as HTMLElement;
  const nextBtn = root.querySelector('#ice-next') as HTMLButtonElement;

  function paintStatic(s: IceState): void {
    laid = layoutBoard(tune, s.rows, s.cols);
    applyTuneCss();
    const parts: string[] = [];
    for (const cell of s.open) {
      const shade = (cell.r + cell.c) % 2 === 0 ? 'is-ice-a' : 'is-ice-b';
      const p = tokenPos(laid, cell);
      parts.push(
        `<div class="ice-cell ${shade}" style="left:${p.x}px;top:${p.y}px;z-index:${stackZ(cell.r, 0)}"></div>`,
      );
    }
    for (const cell of s.walls) {
      const p = tokenPos(laid, cell);
      parts.push(
        `<div class="ice-cell is-wall" style="left:${p.x}px;top:${p.y}px;z-index:${stackZ(cell.r, 2)}"></div>`,
      );
    }
    for (const t of s.stars) {
      const p = tokenPos(laid, t);
      const key = cellKey(t);
      parts.push(
        `<div class="ice-star-glow" data-star-glow="${key}" style="left:${p.x}px;top:${p.y}px;z-index:${stackZ(t.r, 2)}"></div>`,
        `<div class="ice-star" data-star="${key}" style="left:${p.x}px;top:${p.y}px;z-index:${stackZ(t.r, 3)}"></div>`,
      );
    }
    {
      const p = tokenPos(laid, s.door);
      parts.push(
        `<div class="ice-door" style="left:${p.x}px;top:${p.y}px;z-index:${stackZ(s.door.r, 3)}"></div>`,
      );
    }
    s.boxes.forEach((_, i) => {
      parts.push(`<div class="ice-box" id="ice-box-${i}"></div>`);
    });
    parts.push(`<div class="ice-you" id="ice-you"><span class="you-rig"><span class="you-body"></span><span class="you-eye"></span><span class="you-pupil"></span></span></div>`);
    board.style.width = `${laid.gridW}px`;
    board.style.height = `${laid.gridH}px`;
    board.style.left = `${laid.originX}px`;
    board.style.top = `${laid.originY}px`;
    board.innerHTML = parts.join('');
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

  function stackZ(row: number, layer: number): number {
    return (row + 1) * 10 + layer;
  }

  function placeAt(el: HTMLElement, c: Cell): void {
    const p = tokenPos(laid, c);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.zIndex = String(stackZ(c.r, 4));
  }

  function placeTokens(s: IceState): void {
    const you = board.querySelector('#ice-you') as HTMLElement | null;
    if (you) placeAt(you, s.player);
    s.boxes.forEach((b, i) => {
      const el = board.querySelector(`#ice-box-${i}`) as HTMLElement | null;
      if (!el) return;
      placeAt(el, b);
    });
  }

  function hideStar(at: Cell): void {
    const key = cellKey(at);
    board.querySelector(`[data-star="${key}"]`)?.classList.add('gone');
    board.querySelector(`[data-star-glow="${key}"]`)?.classList.add('gone');
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
    if (result.kind === 'stuck' && result.playerPath.length <= 1) {
      void haptics.impact('soft');
      swipe.onMoveSettled();
      return;
    }
    busy = true;
    const you = board.querySelector('#ice-you') as HTMLElement;
    const boxEl =
      result.pushedBox != null
        ? (board.querySelector(`#ice-box-${result.pushedBox}`) as HTMLElement | null)
        : null;
    const picked = result.starsPicked.slice();
    let pi = 0;

    const steps = result.playerPath.length;
    for (let i = 1; i < steps; i++) {
      placeAt(you, result.playerPath[i]!);
      if (boxEl && result.boxPath && result.boxPath[i]) {
        placeAt(boxEl, result.boxPath[i]!);
      }
      const here = result.playerPath[i]!;
      if (picked[pi] && picked[pi]!.r === here.r && picked[pi]!.c === here.c) {
        hideStar(picked[pi]!);
        pi += 1;
      }
      await sleep(STEP_MS);
      if (disposed) return;
    }

    state = result.state;
    starsEl.querySelectorAll('.hud-star').forEach((el, i) => {
      el.classList.toggle('is-on', i < state.collected);
    });
    placeTokens(state);

    if (state.won) {
      const n = ratingStars(state);
      const last = levelIndex >= LEVELS.length - 1;
      overKicker.textContent = last ? '全部通关' : `第 ${LEVELS[levelIndex]!.id} 关`;
      overStars.textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
      nextBtn.textContent = last ? '再来一遍' : '下一关';
      overlay.classList.remove('hidden');
      void haptics.notification('success');
    } else {
      void haptics.impact(result.kind === 'push' ? 'medium' : 'light');
    }
    busy = false;
    swipe.onMoveSettled();
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
      ro.disconnect();
      swipe.dispose();
      root.remove();
    },
  };
}

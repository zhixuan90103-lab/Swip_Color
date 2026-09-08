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

const TUNE_KEY = 'ice-board-tune-v4';
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
    <aside class="tune-panel" id="tune-panel">
      <p class="tune-title">棋盘调参</p>
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
      <p class="tune-hint">宽/高=托盘　格子=砖大小　透明=冰砖不透明度</p>
      <button type="button" class="tune-reset" id="tune-reset">恢复默认</button>
    </aside>
  `;
  root.style.backgroundImage = `url(${import.meta.env.BASE_URL}ui/table-bg.jpg)`;
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
    const door = cellKey(s.door);
    const parts: string[] = [];
    for (const cell of s.open) {
      const k = cellKey(cell);
      const shade = (cell.r + cell.c) % 2 === 0 ? 'is-ice-a' : 'is-ice-b';
      const cls = k === door ? 'ice-cell is-door' : `ice-cell ${shade}`;
      const p = tokenPos(laid, cell);
      parts.push(`<div class="${cls}" style="left:${p.x}px;top:${p.y}px"></div>`);
    }
    for (const cell of s.walls) {
      const p = tokenPos(laid, cell);
      parts.push(
        `<div class="ice-cell is-wall" style="left:${p.x}px;top:${p.y}px"></div>`,
      );
    }
    for (const t of s.stars) {
      const p = tokenPos(laid, t);
      parts.push(
        `<div class="ice-star" data-star="${cellKey(t)}" style="left:${p.x}px;top:${p.y}px"></div>`,
      );
    }
    s.boxes.forEach((_, i) => {
      parts.push(`<div class="ice-box" id="ice-box-${i}"></div>`);
    });
    parts.push(`<div class="ice-you" id="ice-you"></div>`);
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
    const scale = Math.min(1, maxW / tune.boardW, maxH / tune.boardH);
    shell.style.transform = `scale(${scale})`;
  }

  function placeAt(el: HTMLElement, c: Cell): void {
    const p = tokenPos(laid, c);
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
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
    board.querySelector(`[data-star="${cellKey(at)}"]`)?.classList.add('gone');
  }

  function applyTuneCss(): void {
    root.style.setProperty('--ice-board-w', `${tune.boardW}px`);
    root.style.setProperty('--ice-board-h', `${tune.boardH}px`);
    root.style.setProperty('--ice-cell', `${tune.cell}px`);
    root.style.setProperty('--ice-gap', `${tune.gap}px`);
    root.style.setProperty('--ice-inset', `${tune.inset}px`);
    root.style.setProperty('--ice-tile-opacity', String(tune.cellOpacity / 100));
    root.style.setProperty('--ice-shadow-w', `${tune.shadowW}px`);
    root.style.setProperty('--ice-shadow-h', `${tune.shadowH}px`);
  }

  function syncTuneUi(): void {
    (['boardW', 'boardH', 'cell', 'gap', 'inset', 'cellOpacity', 'shadowW', 'shadowH'] as const).forEach((key) => {
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
    if (key === 'cellOpacity' || key === 'shadowW' || key === 'shadowH') {
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

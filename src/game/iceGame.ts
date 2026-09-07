import { haptics } from '../utils/haptics';
import { iceDirFromSwipe } from './dir';
import { FEEL2_DEFAULT } from './feel';
import { applyDir } from './iceSim';
import { attachSwipeInput } from './swipeInput';
import { cellKey, ratingStars, type Cell, type Dir, type IceState } from './iceTypes';
import { LEVELS } from './levels';

const CELL = 52;
const GAP = 8;
const STEP_MS = FEEL2_DEFAULT.slideMs;

export type IceGameHandle = { dispose: () => void };

function tokenPos(c: Cell): { x: number; y: number } {
  return { x: c.c * (CELL + GAP), y: c.r * (CELL + GAP) };
}

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

  const root = document.createElement('div');
  root.className = 'ice-app';
  root.innerHTML = `
    <header class="ice-hud">
      <div class="ice-title" id="ice-title">1 刹车</div>
      <div class="ice-stars" id="ice-stars">☆☆</div>
      <button type="button" class="ice-restart" id="ice-restart">重开</button>
      <button type="button" class="ice-haptic" id="haptic-tap">震</button>
    </header>
    <div class="ice-board-wrap">
      <div class="ice-board-frame">
        <div class="ice-board" id="ice-board"></div>
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
  `;
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
    const door = cellKey(s.door);
    const parts: string[] = [];
    for (const cell of s.open) {
      const k = cellKey(cell);
      const cls = k === door ? 'ice-cell is-door' : 'ice-cell is-ice';
      parts.push(
        `<div class="${cls}" style="left:${cell.c * (CELL + GAP)}px;top:${cell.r * (CELL + GAP)}px"></div>`,
      );
    }
    for (const cell of s.walls) {
      parts.push(
        `<div class="ice-cell is-wall" style="left:${cell.c * (CELL + GAP)}px;top:${cell.r * (CELL + GAP)}px"></div>`,
      );
    }
    for (const t of s.stars) {
      parts.push(
        `<div class="ice-star" data-star="${cellKey(t)}" style="left:${t.c * (CELL + GAP)}px;top:${t.r * (CELL + GAP)}px">★</div>`,
      );
    }
    s.boxes.forEach((_, i) => {
      parts.push(`<div class="ice-box" id="ice-box-${i}"></div>`);
    });
    parts.push(`<div class="ice-you" id="ice-you"></div>`);
    board.style.width = `${s.cols * CELL + (s.cols - 1) * GAP}px`;
    board.style.height = `${s.rows * CELL + (s.rows - 1) * GAP}px`;
    board.innerHTML = parts.join('');
    placeTokens(s);
    const def = LEVELS[levelIndex]!;
    titleEl.textContent = `${def.id} ${def.title}`;
    hintEl.textContent = def.hint;
    starsEl.textContent = '★'.repeat(s.collected) + '☆'.repeat(Math.max(0, 2 - s.collected));
  }

  function placeTokens(s: IceState): void {
    const you = board.querySelector('#ice-you') as HTMLElement | null;
    if (you) {
      const p = tokenPos(s.player);
      you.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
    s.boxes.forEach((b, i) => {
      const el = board.querySelector(`#ice-box-${i}`) as HTMLElement | null;
      if (!el) return;
      const p = tokenPos(b);
      el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    });
  }

  function hideStar(at: Cell): void {
    board.querySelector(`[data-star="${cellKey(at)}"]`)?.classList.add('gone');
  }

  paintStatic(state);

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
      const p = tokenPos(result.playerPath[i]!);
      you.style.transform = `translate(${p.x}px, ${p.y}px)`;
      if (boxEl && result.boxPath && result.boxPath[i]) {
        const b = tokenPos(result.boxPath[i]!);
        boxEl.style.transform = `translate(${b.x}px, ${b.y}px)`;
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
    starsEl.textContent = '★'.repeat(state.collected) + '☆'.repeat(Math.max(0, 2 - state.collected));
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
      swipe.dispose();
      root.remove();
    },
  };
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDir } from './iceSim';
import { cellKey, ratingStars, type Dir, type IceState } from './iceTypes';
import { LEVELS } from './levels';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function play(start: IceState, dirs: Dir[]): IceState {
  let s = start;
  for (const d of dirs) s = applyDir(s, d).state;
  return s;
}

function canThreeStarsWithoutBox(start: IceState): boolean {
  const seen = new Set<string>();
  const q: IceState[] = [start];
  const keyOf = (s: IceState) =>
    `${s.player.r},${s.player.c}|${s.stars.map(cellKey).sort().join(';')}|${s.collected}|${s.won}`;
  seen.add(keyOf(start));
  while (q.length) {
    const cur = q.pop()!;
    if (cur.collected >= 2) return true;
    if (cur.won) continue;
    for (const d of DIRS) {
      const r = applyDir(cur, d);
      if (r.kind === 'push' || r.kind === 'brake') continue;
      const k = keyOf(r.state);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(r.state);
    }
  }
  return false;
}

function returnsToStartBeforeWin(start: IceState, dirs: Dir[]): boolean {
  let s = start;
  const origin = `${start.player.r},${start.player.c}`;
  for (let i = 0; i < dirs.length; i++) {
    s = applyDir(s, dirs[i]!).state;
    if (i < dirs.length - 1 && `${s.player.r},${s.player.c}` === origin) return true;
  }
  return false;
}

function fullKey(s: IceState): string {
  const boxes = s.boxes.map(cellKey).sort().join(';');
  return `${s.player.r},${s.player.c}|${boxes}|${s.stars.map(cellKey).sort().join(';')}|${s.collected}|${s.won}`;
}

function shortestWin(start: IceState, collected: number): Dir[] | null {
  const seen = new Set<string>([fullKey(start)]);
  const q: { s: IceState; path: Dir[] }[] = [{ s: start, path: [] }];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.s.won && cur.s.collected === collected) return cur.path;
    if (cur.s.won || cur.path.length > 18) continue;
    for (const d of DIRS) {
      const r = applyDir(cur.s, d);
      if (r.kind === 'stuck' && r.state.player.r === cur.s.player.r && r.state.player.c === cur.s.player.c) {
        continue;
      }
      const k = fullKey(r.state);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ s: r.state, path: [...cur.path, d] });
    }
  }
  return null;
}

/** 手写满星路：每关解法形状必须不同。 */
const THREE: { id: number; dirs: Dir[] }[] = [
  { id: 1, dirs: ['right', 'right', 'down', 'left', 'right', 'down', 'left'] },
  { id: 2, dirs: ['down', 'left', 'down', 'up', 'right', 'left'] },
  { id: 3, dirs: ['left', 'down', 'left', 'up', 'left', 'right', 'up'] },
  { id: 4, dirs: ['up', 'up', 'left', 'up', 'right', 'down', 'left', 'up', 'right'] },
  {
    id: 5,
    dirs: [
      'right',
      'down',
      'right',
      'down',
      'left',
      'up',
      'down',
      'right',
      'up',
      'left',
      'up',
      'right',
      'right',
      'down',
      'left',
      'down',
    ],
  },
  { id: 6, dirs: ['left', 'left', 'down', 'left', 'right', 'down', 'left', 'up'] },
  { id: 7, dirs: ['up', 'right', 'left', 'up', 'right', 'right', 'down', 'right'] },
  { id: 8, dirs: ['left', 'up', 'right', 'right', 'up', 'right', 'down', 'right'] },
  { id: 9, dirs: ['right', 'down', 'right', 'up', 'right', 'left', 'up'] },
  { id: 10, dirs: ['left', 'up', 'right', 'down', 'left', 'down', 'right', 'down', 'left', 'up'] },
  { id: 11, dirs: ['left', 'down', 'left', 'up', 'down', 'up', 'right', 'up', 'left', 'left', 'down', 'left'] },
  { id: 12, dirs: ['right', 'right', 'up', 'left', 'left', 'right', 'down', 'left', 'up', 'right', 'down'] },
  { id: 13, dirs: ['right', 'up', 'right', 'down', 'down', 'right', 'down', 'left', 'down'] },
  { id: 14, dirs: ['up', 'up', 'left', 'up', 'right', 'up', 'down', 'right'] },
  { id: 15, dirs: ['up', 'up', 'right', 'down', 'up', 'left', 'down', 'left', 'right'] },
];

describe('fifteen levels: 1/2/3 star routes and distinct 3-star', () => {
  const threeSig = new Set<string>();

  for (const def of LEVELS) {
    it(`第${def.id}关 存在 1、2、3 星最短路`, () => {
      const start = def.make();
      const one = shortestWin(start, 0);
      const two = shortestWin(start, 1);
      const three = shortestWin(start, 2);
      assert.ok(one, `L${def.id} 没有 1 星`);
      assert.ok(two, `L${def.id} 没有 2 星`);
      assert.ok(three, `L${def.id} 没有 3 星`);
      assert.equal(canThreeStarsWithoutBox(start), false, `L${def.id} 不用箱子也能两颗星`);

      const s1 = play(start, one);
      const s2 = play(start, two);
      const s3 = play(start, three);
      assert.equal(ratingStars(s1), 1);
      assert.equal(ratingStars(s2), 2);
      assert.equal(ratingStars(s3), 3);
      assert.equal(returnsToStartBeforeWin(start, three), false, `L${def.id} 满星折回起点 ${three.join(',')}`);
      if (def.id <= 5) {
        let s = start;
        let pushes = 0;
        for (const d of three) {
          const r = applyDir(s, d);
          if (r.kind === 'push') pushes += 1;
          s = r.state;
        }
        assert.ok(pushes >= 1, `L${def.id} 满星应至少推一次箱子`);
      }
    });
  }

  for (const route of THREE) {
    const def = LEVELS[route.id - 1]!;
    it(`第${route.id}关 手写 3 星`, () => {
      const start = def.make();
      const sig = route.dirs.join(',');
      assert.equal(threeSig.has(sig), false, `3 星解法重复: ${sig}`);
      threeSig.add(sig);
      assert.equal(returnsToStartBeforeWin(start, route.dirs), false);
      const s = play(start, route.dirs);
      assert.equal(s.won, true, `L${route.id} 未过关 p=${s.player.r},${s.player.c} col=${s.collected}`);
      assert.equal(ratingStars(s), 3, `L${route.id} rating=${ratingStars(s)} col=${s.collected}`);
    });
  }
});

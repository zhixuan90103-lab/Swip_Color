import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyDir } from './iceSim';
import { cellKey, ratingStars, type Dir, type IceState } from './iceTypes';
import { LEVELS } from './levels';

function play(start: IceState, dirs: Dir[]): IceState {
  let s = start;
  for (const d of dirs) s = applyDir(s, d).state;
  return s;
}

function canThreeStarsWithoutBox(start: IceState): boolean {
  const DIRS: Dir[] = ['up', 'down', 'left', 'right'];
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

/** 满星路线不许先回到起点再进门（那是井型折返）。 */
function returnsToStartBeforeWin(start: IceState, dirs: Dir[]): boolean {
  let s = start;
  const origin = `${start.player.r},${start.player.c}`;
  for (let i = 0; i < dirs.length; i++) {
    s = applyDir(s, dirs[i]!).state;
    if (i < dirs.length - 1 && `${s.player.r},${s.player.c}` === origin) return true;
  }
  return false;
}

const ROUTES: { id: number; one: Dir[]; three: Dir[] }[] = [
  { id: 1, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 2, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 3, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 4, one: ['down'], three: ['right', 'right', 'down', 'left'] },
  { id: 5, one: ['down'], three: ['right', 'down', 'left', 'down'] },
  { id: 6, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 7, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 8, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 9, one: ['down'], three: ['right', 'down', 'left'] },
  { id: 10, one: ['down'], three: ['right', 'down', 'left', 'down'] },
];

describe('ten levels path-manage with the box', () => {
  for (const route of ROUTES) {
    const def = LEVELS[route.id - 1]!;
    it(`第${route.id}关 1 星空手进门`, () => {
      const s = play(def.make(), route.one);
      assert.equal(s.won, true);
      assert.equal(s.collected, 0);
    });
    it(`第${route.id}关 3 星用箱子向前走`, () => {
      assert.equal(canThreeStarsWithoutBox(def.make()), false, `L${route.id} 不用箱子也能吃两颗星`);
      assert.equal(returnsToStartBeforeWin(def.make(), route.three), false, `L${route.id} 满星折回起点`);
      const s = play(def.make(), route.three);
      assert.equal(s.won, true);
      assert.equal(ratingStars(s), 3, `L${route.id} rating=${ratingStars(s)} p=${s.player.r},${s.player.c}`);
    });
  }
});

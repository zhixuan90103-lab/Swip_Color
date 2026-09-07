import { applyDir } from '../src/game/iceSim.ts';
import { cellKey, type Dir, type IceState } from '../src/game/iceTypes.ts';
import { LEVELS } from '../src/game/levels.ts';

const DIRS: Dir[] = ['up', 'down', 'left', 'right'];

function fullKey(s: IceState): string {
  const boxes = s.boxes.map(cellKey).sort().join(';');
  return `${s.player.r},${s.player.c}|${boxes}|${s.stars.map(cellKey).sort().join(';')}|${s.collected}|${s.won}`;
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

function shortestWin(start: IceState, collected: number, cap: number): Dir[] | null {
  const seen = new Set<string>([fullKey(start)]);
  const q: { s: IceState; path: Dir[] }[] = [{ s: start, path: [] }];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.s.won && cur.s.collected === collected) return cur.path;
    if (cur.s.won || cur.path.length > cap) continue;
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

function pushes(start: IceState, dirs: Dir[]): number {
  let s = start;
  let n = 0;
  for (const d of dirs) {
    const r = applyDir(s, d);
    if (r.kind === 'push') n += 1;
    s = r.state;
  }
  return n;
}

const cap = 22;
const sigs = new Set<string>();
for (const def of LEVELS) {
  const start = def.make();
  const one = shortestWin(start, 0, cap);
  const two = shortestWin(start, 1, cap);
  const three = shortestWin(start, 2, cap);
  const noBox = canThreeStarsWithoutBox(start);
  const ret = three ? returnsToStartBeforeWin(start, three) : false;
  const p = three ? pushes(start, three) : -1;
  const sig = three ? three.join(',') : '-';
  const dup = three && sigs.has(sig);
  if (three) sigs.add(sig);
  const ok = one && two && three && !noBox && !ret && !dup;
  console.log(
    `${ok ? 'OK' : 'FAIL'} L${def.id} 1:${one?.join('') ?? '-'} 2:${two?.join('') ?? '-'} 3:${sig} noBox2=${noBox} ret3=${ret} push=${p} dup=${!!dup}`,
  );
}
console.log('n', LEVELS.length);

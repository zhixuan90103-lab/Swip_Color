import {
  DIR_DELTA,
  cellKey,
  sameCell,
  type Cell,
  type Dir,
  type IceState,
  type SlideKind,
  type SlideResult,
} from './iceTypes';

function cloneState(s: IceState): IceState {
  return {
    rows: s.rows,
    cols: s.cols,
    player: { ...s.player },
    boxes: s.boxes.map((b) => ({ ...b })),
    stars: s.stars.map((t) => ({ ...t })),
    door: { ...s.door },
    open: s.open.map((c) => ({ ...c })),
    walls: s.walls.map((w) => ({ ...w })),
    collected: s.collected,
    won: s.won,
  };
}

function wallSet(s: IceState): Set<string> {
  return new Set(s.walls.map(cellKey));
}

function boxIndexAt(s: IceState, r: number, c: number): number {
  return s.boxes.findIndex((b) => b.r === r && b.c === c);
}

function openSet(s: IceState): Set<string> {
  return new Set(s.open.map(cellKey));
}

function blockedTerrain(s: IceState, walls: Set<string>, open: Set<string>, r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) return true;
  if (walls.has(cellKey({ r, c }))) return true;
  return !open.has(cellKey({ r, c }));
}

function isSolidForPlayer(s: IceState, walls: Set<string>, open: Set<string>, r: number, c: number): boolean {
  if (blockedTerrain(s, walls, open, r, c)) return true;
  return boxIndexAt(s, r, c) >= 0;
}

function isSolidForBox(
  s: IceState,
  walls: Set<string>,
  open: Set<string>,
  r: number,
  c: number,
  movingIndex: number,
): boolean {
  if (blockedTerrain(s, walls, open, r, c)) return true;
  if (sameCell(s.door, { r, c })) return true;
  const i = boxIndexAt(s, r, c);
  return i >= 0 && i !== movingIndex;
}

function pickStar(s: IceState, at: Cell, picked: Cell[]): void {
  const i = s.stars.findIndex((t) => sameCell(t, at));
  if (i < 0) return;
  s.stars.splice(i, 1);
  s.collected += 1;
  picked.push({ ...at });
}

function enterCell(s: IceState, at: Cell, picked: Cell[]): boolean {
  pickStar(s, at, picked);
  if (sameCell(s.door, at)) {
    s.won = true;
    s.player = { ...at };
    return true;
  }
  return false;
}

export function applyDir(state: IceState, dir: Dir): SlideResult {
  const s = cloneState(state);
  const start = { ...s.player };
  const playerPath: Cell[] = [start];
  const picked: Cell[] = [];
  if (s.won) {
    return { state: s, kind: 'stuck', playerPath, boxPath: null, pushedBox: null, starsPicked: picked };
  }

  const d = DIR_DELTA[dir];
  const walls = wallSet(s);
  const open = openSet(s);
  const faceR = s.player.r + d.r;
  const faceC = s.player.c + d.c;
  const faceBox = boxIndexAt(s, faceR, faceC);

  if (faceBox >= 0) {
    const boxPath: Cell[] = [{ ...s.boxes[faceBox]! }];
    let moved = false;
    while (true) {
      const box = s.boxes[faceBox]!;
      const nr = box.r + d.r;
      const nc = box.c + d.c;
      if (isSolidForBox(s, walls, open, nr, nc, faceBox)) break;
      s.player = { r: box.r, c: box.c };
      s.boxes[faceBox] = { r: nr, c: nc };
      playerPath.push({ ...s.player });
      boxPath.push({ r: nr, c: nc });
      moved = true;
      if (enterCell(s, s.player, picked)) break;
    }
    const kind: SlideKind = moved ? 'push' : 'stuck';
    return {
      state: s,
      kind,
      playerPath,
      boxPath: moved ? boxPath : null,
      pushedBox: moved ? faceBox : null,
      starsPicked: picked,
    };
  }

  let kind: SlideKind = 'stuck';
  while (true) {
    const nr = s.player.r + d.r;
    const nc = s.player.c + d.c;
    if (isSolidForPlayer(s, walls, open, nr, nc)) {
      if (boxIndexAt(s, nr, nc) >= 0 && playerPath.length > 1) kind = 'brake';
      break;
    }
    s.player = { r: nr, c: nc };
    playerPath.push({ ...s.player });
    kind = 'slide';
    if (enterCell(s, s.player, picked)) break;
  }
  if (kind === 'stuck' && playerPath.length === 1 && boxIndexAt(s, faceR, faceC) >= 0) {
    kind = 'brake';
  }
  return { state: s, kind, playerPath, boxPath: null, pushedBox: null, starsPicked: picked };
}

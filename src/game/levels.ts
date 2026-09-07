import type { Cell, IceState, LevelDef } from './iceTypes';

function at(r: number, c: number): Cell {
  return { r, c };
}

function fillOpen(rows: number, cols: number): Cell[] {
  const open: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) open.push(at(r, c));
  }
  return open;
}

function level(
  rows: number,
  cols: number,
  rest: Pick<IceState, 'player' | 'boxes' | 'stars' | 'door'> & Partial<Pick<IceState, 'walls'>>,
): IceState {
  return {
    rows,
    cols,
    open: fillOpen(rows, cols),
    walls: rest.walls ?? [],
    player: rest.player,
    boxes: rest.boxes,
    stars: rest.stars,
    door: rest.door,
    collected: 0,
    won: false,
  };
}

/**
 * 箱子当转弯钉：停在井口后往下，再沿底边吃第二颗星进门。
 * 满星是一条向前的 L，不回起点。
 */
function turnL(opts: {
  cols: number;
  box: Cell;
  stopC: number;
  extraWalls?: Cell[];
  extraBoxes?: Cell[];
}): IceState {
  const { cols, box, stopC, extraWalls = [], extraBoxes = [] } = opts;
  return level(3, cols, {
    player: at(0, 0),
    boxes: [box, ...extraBoxes],
    stars: [at(1, stopC), at(2, 1)],
    door: at(2, 0),
    walls: [at(1, stopC - 1), at(1, stopC + 1), ...extraWalls],
  });
}

export function makeLevel1(): IceState {
  return turnL({ cols: 4, box: at(0, 3), stopC: 2 });
}

export function makeLevel2(): IceState {
  return turnL({ cols: 4, box: at(0, 1), stopC: 2 });
}

export function makeLevel3(): IceState {
  return turnL({ cols: 6, box: at(0, 5), stopC: 4 });
}

export function makeLevel4(): IceState {
  return turnL({ cols: 6, box: at(0, 3), stopC: 4 });
}

/** 顶刹 + 底刹：停两回，最后一格才是门。 */
export function makeLevel5(): IceState {
  return level(4, 5, {
    player: at(0, 0),
    boxes: [at(0, 3), at(3, 2)],
    stars: [at(1, 2), at(2, 1)],
    door: at(3, 0),
    walls: [at(1, 1), at(1, 3)],
  });
}

export function makeLevel6(): IceState {
  return turnL({ cols: 6, box: at(0, 5), stopC: 4, extraWalls: [at(2, 5)] });
}

export function makeLevel7(): IceState {
  return turnL({ cols: 5, box: at(0, 1), stopC: 2, extraBoxes: [at(0, 4)] });
}

/** 推的路上吃一颗，再转弯吃第二颗进门。 */
export function makeLevel8(): IceState {
  return level(3, 4, {
    player: at(0, 0),
    boxes: [at(0, 1)],
    stars: [at(0, 2), at(2, 1)],
    door: at(2, 0),
    walls: [at(1, 1), at(1, 3)],
  });
}

export function makeLevel9(): IceState {
  return turnL({ cols: 4, box: at(0, 3), stopC: 2, extraWalls: [at(2, 3)] });
}

export function makeLevel10(): IceState {
  return level(4, 5, {
    player: at(0, 0),
    boxes: [at(0, 3), at(3, 2)],
    stars: [at(1, 2), at(2, 1)],
    door: at(3, 0),
    walls: [at(1, 1), at(1, 3), at(2, 4), at(1, 4)],
  });
}

export const LEVELS: LevelDef[] = [
  { id: 1, title: '转弯钉', hint: '向右撞箱停住，往下吃星，再向左进门。不要原路回去。', make: makeLevel1 },
  { id: 2, title: '推着转', hint: '贴着推，人停在转弯格，再下、再左。', make: makeLevel2 },
  { id: 3, title: '远钉', hint: '箱子更远，还是撞停再转。', make: makeLevel3 },
  { id: 4, title: '滑到再推', hint: '先滑到贴箱，再推到转弯格。', make: makeLevel4 },
  { id: 5, title: '两颗钉', hint: '上面撞一次，下面再撞一次，最后才进门。', make: makeLevel5 },
  { id: 6, title: '多一块', hint: '底下一块墙不挡路，还是撞停再转。', make: makeLevel6 },
  { id: 7, title: '顶住', hint: '近箱推到远箱上，人刚好停在转弯格。', make: makeLevel7 },
  { id: 8, title: '推路上的星', hint: '推的时候就吃掉一颗，再下、再左。', make: makeLevel8 },
  { id: 9, title: '死角', hint: '右下是墙，满星仍是右、下、左。', make: makeLevel9 },
  { id: 10, title: '两钉加墙', hint: '上面撞、下面撞，右边的墙不用管。', make: makeLevel10 },
];

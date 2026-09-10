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

type Facing = 'id' | 'cw' | 'ccw' | '180';

/** 整盘旋转：人/箱/星/门/墙一起转，停点关系不变，门改边。 */
function orient(s: IceState, facing: Facing): IceState {
  if (facing === 'id') return s;
  const map =
    facing === 'cw'
      ? (c: Cell) => at(c.c, s.rows - 1 - c.r)
      : facing === 'ccw'
        ? (c: Cell) => at(s.cols - 1 - c.c, c.r)
        : (c: Cell) => at(s.rows - 1 - c.r, s.cols - 1 - c.c);
  const rows = facing === '180' ? s.rows : s.cols;
  const cols = facing === '180' ? s.cols : s.rows;
  return {
    rows,
    cols,
    open: fillOpen(rows, cols),
    walls: s.walls.map(map),
    player: map(s.player),
    boxes: s.boxes.map(map),
    stars: s.stars.map(map),
    door: map(s.door),
    collected: 0,
    won: false,
  };
}

/** ① 撞停对齐底中门。 */
export function makeLevel1(): IceState {
  return orient(level(5, 5, {
    player: at(0, 0),
    boxes: [at(0, 3), at(1, 4)],
    stars: [at(2, 0), at(2, 4)],
    door: at(4, 2),
    walls: [at(3, 1), at(3, 3), at(4, 3)],
  }), 'id');
}

/** ② 贴着推到头，再绕去吃星进门。 */
export function makeLevel2(): IceState {
  return orient(level(5, 6, {
    player: at(1, 0),
    boxes: [at(1, 1), at(1, 5)],
    stars: [at(0, 2), at(3, 5)],
    door: at(4, 2),
    walls: [at(2, 0), at(3, 1), at(4, 1), at(4, 3), at(0, 5)],
  }), 'cw');
}

/** 右推到 B，绕北再下推到 C，回头进门。 */
export function makeLevel3(): IceState {
  return orient(level(5, 6, {
    player: at(1, 0),
    boxes: [at(1, 1), at(1, 5)],
    stars: [at(0, 4), at(3, 5)],
    door: at(4, 2),
    walls: [at(2, 0), at(3, 1), at(4, 1), at(4, 3), at(0, 5)],
  }), '180');
}

/** 枢纽钉：中间箱先别推，多面撞停。 */
export function makeLevel4(): IceState {
  return orient(level(5, 5, {
    player: at(2, 0),
    boxes: [at(2, 2), at(3, 3)],
    stars: [at(0, 2), at(2, 4)],
    door: at(4, 2),
    walls: [at(4, 1), at(4, 3), at(0, 3)],
  }), 'ccw');
}

/** 先停后推，顶上多一只箱。 */
export function makeLevel5(): IceState {
  return orient(
    level(5, 6, {
      player: at(1, 0),
      boxes: [at(1, 2), at(1, 5), at(0, 3)],
      stars: [at(0, 4), at(3, 5)],
      door: at(4, 2),
      walls: [at(2, 0), at(3, 1), at(4, 1), at(4, 3), at(0, 5)],
    }),
    'id',
  );
}

/** 枢纽用完再推走。 */
export function makeLevel6(): IceState {
  return orient(level(5, 5, {
    player: at(2, 0),
    boxes: [at(2, 2), at(3, 3), at(0, 4)],
    stars: [at(0, 2), at(1, 4)],
    door: at(4, 2),
    walls: [at(4, 1), at(4, 3), at(0, 3)],
  }), '180');
}

/** 先当刹车，再推到门列。 */
export function makeLevel7(): IceState {
  return orient(level(6, 6, {
    player: at(1, 0),
    boxes: [at(1, 2), at(4, 5)],
    stars: [at(0, 4), at(5, 1)],
    door: at(5, 3),
    walls: [at(2, 0), at(4, 2), at(5, 2), at(5, 4)],
  }), 'ccw');
}

/** 偏置枢纽：钉子不在正中。 */
export function makeLevel8(): IceState {
  return orient(level(5, 6, {
    player: at(2, 0),
    boxes: [at(2, 3), at(4, 1)],
    stars: [at(0, 3), at(2, 5)],
    door: at(4, 4),
    walls: [at(4, 3), at(4, 5), at(0, 4)],
  }), 'ccw');
}

/** 从下往上推到再推，门在顶边。 */
export function makeLevel9(): IceState {
  return orient(
    level(5, 6, {
      player: at(3, 0),
      boxes: [at(3, 1), at(3, 5)],
      stars: [at(4, 4), at(1, 5)],
      door: at(0, 2),
      walls: [at(2, 0), at(1, 1), at(0, 1), at(0, 3), at(4, 5)],
    }),
    'id',
  );
}

/** 先停后推，门偏右。 */
export function makeLevel10(): IceState {
  return orient(
    level(5, 6, {
      player: at(1, 0),
      boxes: [at(1, 2), at(1, 5)],
      stars: [at(0, 4), at(3, 5)],
      door: at(4, 4),
      walls: [at(2, 0), at(4, 3), at(4, 5), at(0, 5)],
    }),
    '180',
  );
}

/** 从上往下撞枢纽。 */
export function makeLevel11(): IceState {
  return orient(
    level(5, 5, {
      player: at(0, 2),
      boxes: [at(2, 2), at(3, 3)],
      stars: [at(2, 0), at(2, 4)],
      door: at(4, 2),
      walls: [at(4, 1), at(4, 3), at(1, 4)],
    }),
    'cw',
  );
}

/** 枢纽钉多一只闲箱挡边。 */
export function makeLevel12(): IceState {
  return orient(
    level(5, 5, {
      player: at(2, 0),
      boxes: [at(2, 2), at(3, 3), at(1, 1)],
      stars: [at(0, 2), at(2, 4)],
      door: at(4, 2),
      walls: [at(4, 1), at(4, 3), at(0, 3)],
    }),
    'id',
  );
}

/** 偏心钉，多一只顶上的闲箱。 */
export function makeLevel13(): IceState {
  return orient(
    level(5, 6, {
      player: at(2, 0),
      boxes: [at(2, 3), at(4, 1), at(0, 1)],
      stars: [at(0, 3), at(2, 5)],
      door: at(4, 4),
      walls: [at(4, 3), at(4, 5), at(0, 4)],
    }),
    'id',
  );
}

/** 先 ① 停住，走开，再回来 ② 同一只。 */
export function makeLevel14(): IceState {
  return orient(level(5, 6, {
    player: at(1, 0),
    boxes: [at(1, 2), at(1, 5)],
    stars: [at(0, 4), at(3, 5)],
    door: at(4, 2),
    walls: [at(2, 0), at(3, 1), at(4, 1), at(4, 3), at(0, 5)],
  }), 'ccw');
}

/** 枢纽两次 + 推到 C + 再刹车进门。 */
export function makeLevel15(): IceState {
  return orient(
    level(6, 6, {
      player: at(2, 0),
      boxes: [at(2, 2), at(0, 5), at(5, 4)],
      stars: [at(0, 2), at(4, 0)],
      door: at(5, 2),
      walls: [at(5, 1), at(5, 3), at(1, 3), at(3, 1)],
    }),
    'ccw',
  );
}

const META: { title: string; hint: string }[] = [
  { title: '撞停', hint: '撞到箱子会停。停在门前那一列再进去。' },
  { title: '贴着推', hint: '贴着再滑，箱子跟人一起走。' },
  { title: '推到再推', hint: '先推到头，绕过去再推一次。空出来的路可以走回去。' },
  { title: '枢纽', hint: '中间那只箱先别推。从不同方向撞停。' },
  { title: '星在角', hint: '先停后推。顶上多一只箱挡路。' },
  { title: '用完再走', hint: '同一只钉先当枢纽，再推到新位置接着用。' },
  { title: '停完再搬', hint: '先当刹车用完，再把它推到门前。' },
  { title: '偏心钉', hint: '车站不在正中间。先找到能停的那一格。' },
  { title: '从下往上', hint: '先往右推到头，绕下去再往上推。回头进顶门。' },
  { title: '门偏右', hint: '先停后推。门在右下，停点不一样。' },
  { title: '从上往下', hint: '人在顶上。往下撞那只枢纽钉。' },
  { title: '闲箱', hint: '多一只箱堵着角。中间那只还是枢纽。' },
  { title: '顶上闲箱', hint: '偏心钉。顶上多一只箱，绕路吃星。' },
  { title: '先停后推', hint: '先撞停。走开把路走通，再回来推同一只。' },
  { title: '收束', hint: '枢纽、推走、再停，三步进门。' },
];

const MAKES = [
  makeLevel1,
  makeLevel2,
  makeLevel3,
  makeLevel4,
  makeLevel5,
  makeLevel6,
  makeLevel7,
  makeLevel8,
  makeLevel9,
  makeLevel10,
  makeLevel11,
  makeLevel12,
  makeLevel13,
  makeLevel14,
  makeLevel15,
];

export const LEVELS: LevelDef[] = MAKES.map((make, i) => ({
  id: i + 1,
  title: META[i]!.title,
  hint: META[i]!.hint,
  make,
}));

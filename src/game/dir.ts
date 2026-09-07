/** 与旧 2048 手势同一套：0 上 · 1 右 · 2 下 · 3 左 */
export type Dir = 0 | 1 | 2 | 3;

export type IceDir = 'up' | 'down' | 'left' | 'right';

export function iceDirFromSwipe(dir: Dir): IceDir {
  if (dir === 0) return 'up';
  if (dir === 1) return 'right';
  if (dir === 2) return 'down';
  return 'left';
}

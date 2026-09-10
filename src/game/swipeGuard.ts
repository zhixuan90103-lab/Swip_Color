/**
 * 起手过滤：letterbox 外不进棋；顶/底安全带相对舞台，不是窗口。
 */

export type ClientBox = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function clientInStage(
  clientX: number,
  clientY: number,
  box: ClientBox,
): boolean {
  return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
}

/** 相对舞台顶/底的安全带（client px）。在带内起手整次不走棋。 */
export function clientInSystemEdge(
  clientY: number,
  box: Pick<ClientBox, 'top' | 'bottom'>,
  topBand: number,
  bottomBand: number,
): boolean {
  return clientY < box.top + topBand || clientY > box.bottom - bottomBand;
}

/**
 * 抬手失败回声：只短滑（过死区未过出手）或已锁慢滑。
 * 斜着等直、连甩补判时速度窗已过，不要砸一下当成误操作。
 */
export function shouldAckUnfiredLift(opts: {
  fired: boolean;
  lastDir: number | null;
  dist: number;
  slop: number;
  commit: number;
  slowDrag: boolean;
}): boolean {
  if (opts.fired || opts.lastDir !== null || opts.dist < opts.slop) return false;
  return opts.slowDrag || opts.dist < opts.commit;
}

/** 上一划的 pointerup 迟到且 pointerId 复用：时间戳早于本次按下，必须丢掉。 */
export function isStalePointer(eventTs: number, downTs: number): boolean {
  return eventTs < downTs;
}

/** 格点还在滑：这一下够出手则先存方向，滑完再走。已有存档不覆盖。 */
export function stashBusyFire(
  pending: number | null,
  fire: number | null,
  lastDir: number | null,
  fired: boolean,
): number | null {
  if (pending !== null || lastDir !== null || fired || fire === null) return pending;
  return fire;
}

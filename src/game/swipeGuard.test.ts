import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clientInStage,
  clientInSystemEdge,
  shouldAckUnfiredLift,
  stashBusyFire,
  isStalePointer,
} from './swipeGuard.ts';

const stage = { left: 100, right: 490, top: 50, bottom: 894 };

describe('swipeGuard', () => {
  it('letterbox 外不在舞台', () => {
    assert.equal(clientInStage(50, 400, stage), false);
    assert.equal(clientInStage(300, 20, stage), false);
    assert.equal(clientInStage(300, 400, stage), true);
  });

  it('安全带相对舞台顶底，不是窗口 0', () => {
    assert.equal(clientInSystemEdge(80, stage, 59, 34), true);
    assert.equal(clientInSystemEdge(400, stage, 59, 34), false);
    assert.equal(clientInSystemEdge(870, stage, 59, 34), true);
    assert.equal(clientInSystemEdge(10, { top: 0, bottom: 844 }, 59, 34), true);
  });

  it('点按不 ack；短滑 ack；斜着等直过 commit 不 ack', () => {
    assert.equal(
      shouldAckUnfiredLift({
        fired: false,
        lastDir: null,
        dist: 4,
        slop: 10,
        commit: 30,
        slowDrag: false,
      }),
      false,
    );
    assert.equal(
      shouldAckUnfiredLift({
        fired: false,
        lastDir: null,
        dist: 20,
        slop: 10,
        commit: 30,
        slowDrag: false,
      }),
      true,
    );
    assert.equal(
      shouldAckUnfiredLift({
        fired: false,
        lastDir: null,
        dist: 80,
        slop: 10,
        commit: 30,
        slowDrag: false,
      }),
      false,
    );
    assert.equal(
      shouldAckUnfiredLift({
        fired: false,
        lastDir: null,
        dist: 80,
        slop: 10,
        commit: 30,
        slowDrag: true,
      }),
      true,
    );
  });
});

describe('isStalePointer', () => {
  it('按下之后才发生的事件才算本段', () => {
    assert.equal(isStalePointer(100, 200), true);
    assert.equal(isStalePointer(200, 200), false);
    assert.equal(isStalePointer(201, 200), false);
  });
});

describe('stashBusyFire', () => {
  it('忙时只存第一次出手', () => {
    assert.equal(stashBusyFire(null, 1, null, false), 1);
    assert.equal(stashBusyFire(1, 2, null, false), 1);
    assert.equal(stashBusyFire(null, 1, 3, false), null);
    assert.equal(stashBusyFire(null, 1, null, true), null);
    assert.equal(stashBusyFire(null, null, null, false), null);
  });
});

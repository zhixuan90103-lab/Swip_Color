import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideFlick, isLightPressure } from './swipeFlick.ts';

const base = {
  axis: null as 0 | 1 | null,
  slop: 10,
  commit: 30,
  axisRatio: 1.55,
  speedMin: 200,
  slow: false,
  fired: false,
  allowFork: false,
};

describe('decideFlick', () => {
  it('向下位移出手下，不看速度符号', () => {
    const d = decideFlick({ ...base, dx: 0, dy: 40, speed: 400 });
    assert.equal(d.fire, 2);
  });

  it('向上位移出手上', () => {
    const d = decideFlick({ ...base, dx: 0, dy: -40, speed: 400 });
    assert.equal(d.fire, 0);
  });

  it('已出手不再走', () => {
    const d = decideFlick({ ...base, dx: 0, dy: 40, speed: 400, fired: true });
    assert.equal(d.fire, null);
  });

  it('慢滑不出手', () => {
    const d = decideFlick({ ...base, dx: 0, dy: 80, speed: 80 });
    assert.equal(d.fire, null);
    assert.equal(d.axis, 0);
  });

  it('轻触压感', () => {
    assert.equal(isLightPressure(0.1, 'touch'), true);
    assert.equal(isLightPressure(0.5, 'touch'), false);
    assert.equal(isLightPressure(0, 'touch'), false);
  });

  it('早先像横、后来竖更长则走下，不沿横轴出手', () => {
    const d = decideFlick({
      ...base,
      axis: 1,
      dx: 32,
      dy: 56,
      speed: 400,
    });
    assert.equal(d.fire, 2);
  });

  it('忙时不允许分叉：45° 两可也不改判', () => {
    const d = decideFlick({
      ...base,
      dx: 40,
      dy: 40,
      speed: 400,
      allowFork: false,
      legal: () => true,
    });
    assert.equal(d.fire, null);
  });
});

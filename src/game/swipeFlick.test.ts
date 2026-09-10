import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideFlick, isLightPressure } from './swipeFlick.ts';

const base = {
  commit: 30,
  axisRatio: 1.55,
  speedMin: 200,
  slow: false,
  fired: false,
};

describe('decideFlick', () => {
  it('向下位移出手下', () => {
    assert.equal(decideFlick({ ...base, dx: 0, dy: 40, speed: 400 }).fire, 2);
  });

  it('向上位移出手上', () => {
    assert.equal(decideFlick({ ...base, dx: 0, dy: -40, speed: 400 }).fire, 0);
  });

  it('已出手不再走', () => {
    assert.equal(decideFlick({ ...base, dx: 0, dy: 40, speed: 400, fired: true }).fire, null);
  });

  it('慢滑不出手', () => {
    const d = decideFlick({ ...base, dx: 0, dy: 80, speed: 80 });
    assert.equal(d.fire, null);
    assert.equal(d.axis, 0);
  });

  it('太斜等甩直', () => {
    assert.equal(decideFlick({ ...base, dx: 40, dy: 40, speed: 400 }).fire, null);
  });

  it('后来竖更长则走下，不沿早先横位移出手', () => {
    assert.equal(decideFlick({ ...base, dx: 32, dy: 56, speed: 400 }).fire, 2);
  });

  it('轻触压感', () => {
    assert.equal(isLightPressure(0.1, 'touch'), true);
    assert.equal(isLightPressure(0.5, 'touch'), false);
    assert.equal(isLightPressure(0, 'touch'), false);
  });
});

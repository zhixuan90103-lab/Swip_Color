import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { YOU_HIT_AMP_MIN } from './youMotion';
import {
  HAPTIC_INTENSITY_MAX,
  crateOnCrate,
  landFeel,
  landIntensity,
  sharpnessForSurface,
  shouldNudge,
  stopSurface,
} from './hapticFeel';
import type { IceState } from './iceTypes';

function board(over: Partial<IceState> = {}): IceState {
  return {
    rows: 3,
    cols: 3,
    player: { r: 1, c: 1 },
    boxes: [],
    stars: [],
    door: { r: 2, c: 2 },
    open: [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
      { r: 1, c: 0 },
      { r: 1, c: 1 },
      { r: 1, c: 2 },
      { r: 2, c: 0 },
      { r: 2, c: 1 },
      { r: 2, c: 2 },
    ],
    walls: [],
    collected: 0,
    won: false,
    ...over,
  };
}

describe('hapticFeel', () => {
  it('scales intensity with hit amp', () => {
    const lo = landIntensity(YOU_HIT_AMP_MIN);
    const hi = landIntensity(1);
    assert.ok(lo > 0.4 && lo < 0.55);
    assert.ok(hi > 0.7 && hi <= HAPTIC_INTENSITY_MAX);
    assert.ok(hi > lo);
  });

  it('maps surfaces to sharpness', () => {
    assert.ok(sharpnessForSurface('stone') > sharpnessForSurface('wood-crate'));
    assert.ok(sharpnessForSurface('wood-crate') < sharpnessForSurface('stone'));
    assert.ok(sharpnessForSurface('wood-frame') < sharpnessForSurface('stone'));
    assert.ok(sharpnessForSurface('none') < sharpnessForSurface('wood-crate'));
  });

  it('detects stone wall, crate, and frame', () => {
    const s = board({ walls: [{ r: 1, c: 2 }] });
    assert.equal(stopSurface(s, { r: 1, c: 1 }, 'right'), 'stone');
    const c = board({ boxes: [{ r: 1, c: 2 }] });
    assert.equal(stopSurface(c, { r: 1, c: 1 }, 'right'), 'wood-crate');
    assert.equal(stopSurface(board(), { r: 1, c: 0 }, 'left'), 'wood-frame');
  });

  it('crate-on-crate lowers intensity', () => {
    const s = board({
      boxes: [
        { r: 1, c: 1 },
        { r: 1, c: 2 },
      ],
      player: { r: 1, c: 0 },
    });
    assert.equal(crateOnCrate(s, { r: 1, c: 0 }, 'right'), true);
    const a = landFeel(2, 'wood-crate', false);
    const b = landFeel(2, 'wood-crate', true);
    assert.ok(b.intensity < a.intensity);
  });

  it('jelly only at full slide', () => {
    assert.equal(landFeel(6, 'stone').jelly, false);
    assert.equal(landFeel(7, 'stone').jelly, true);
  });

  it('zero-cell stuck/brake is a nudge', () => {
    assert.equal(shouldNudge('stuck', 0), true);
    assert.equal(shouldNudge('brake', 0), true);
    assert.equal(shouldNudge('slide', 3), false);
    assert.equal(shouldNudge('push', 2), false);
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  YOU_HIT_AMP_MIN,
  YOU_HIT_TOTAL_MS,
  hitAmpForCells,
  hitDurationMs,
} from './youMotion';

test('slam scales with cells for slide and push', () => {
  assert.equal(hitAmpForCells(1), YOU_HIT_AMP_MIN);
  assert.ok(hitAmpForCells(2) > hitAmpForCells(1));
  assert.ok(hitAmpForCells(4) < 1);
  assert.equal(hitAmpForCells(7), 1);
});

test('in-place bump uses 45% amp', () => {
  assert.equal(hitAmpForCells(0), YOU_HIT_AMP_MIN);
  assert.equal(YOU_HIT_AMP_MIN, 0.45);
});

test('full-amp hit is faster than short bump', () => {
  assert.equal(YOU_HIT_TOTAL_MS, 310);
  assert.equal(hitDurationMs(7), 310);
  assert.equal(hitDurationMs(0), 370);
  assert.equal(hitDurationMs(1), 370);
});

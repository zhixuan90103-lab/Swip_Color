import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  YOU_HIT_AMP_MIN,
  YOU_HIT_TOTAL_MS,
  hitAmpForCells,
  hitDurationMs,
} from './youMotion';

test('full slam for any slide of 1+ cells', () => {
  assert.equal(hitAmpForCells(1), 1);
  assert.equal(hitAmpForCells(4), 1);
});

test('in-place bump uses 45% amp', () => {
  assert.equal(hitAmpForCells(0), YOU_HIT_AMP_MIN);
  assert.equal(YOU_HIT_AMP_MIN, 0.45);
});

test('full-amp hit is faster than in-place', () => {
  assert.equal(YOU_HIT_TOTAL_MS, 310);
  assert.equal(hitDurationMs(1), 310);
  assert.equal(hitDurationMs(0), 370);
});

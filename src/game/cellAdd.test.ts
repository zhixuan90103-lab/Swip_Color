import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL_ADD_FADE_MS, CELL_ADD_OP, cellAddFadeMs } from './cellAdd';

test('additive fade scales with step duration', () => {
  assert.equal(CELL_ADD_OP, 0.4);
  assert.equal(CELL_ADD_FADE_MS, 450);
  assert.equal(cellAddFadeMs(50, 50), 450);
  assert.equal(cellAddFadeMs(90, 50), 810);
});

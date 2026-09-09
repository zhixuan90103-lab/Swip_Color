import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CELL_ADD_FADE_MS, CELL_ADD_OP, cellAddFadeMs } from './cellAdd';

test('occupancy wash is 0.5 on the current cell', () => {
  assert.equal(CELL_ADD_OP, 0.5);
  assert.equal(CELL_ADD_FADE_MS, 450);
  assert.equal(cellAddFadeMs(50, 50), 450);
  assert.equal(cellAddFadeMs(90, 50), 810);
});

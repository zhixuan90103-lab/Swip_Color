import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Z_LAYER, stackZ } from './boardStack';

test('floor ice and add ignore row so they never cover actors', () => {
  assert.equal(stackZ(0, Z_LAYER.ice), 0);
  assert.equal(stackZ(9, Z_LAYER.ice), 0);
  assert.equal(stackZ(0, Z_LAYER.add), 1);
  assert.equal(stackZ(9, Z_LAYER.add), 1);
  assert.ok(stackZ(0, Z_LAYER.you) > stackZ(9, Z_LAYER.add));
});

test('same row: door under star under box under you', () => {
  assert.ok(stackZ(2, Z_LAYER.add) < stackZ(2, Z_LAYER.glow));
  assert.ok(stackZ(2, Z_LAYER.door) < stackZ(2, Z_LAYER.star));
  assert.ok(stackZ(2, Z_LAYER.star) < stackZ(2, Z_LAYER.box));
  assert.ok(stackZ(2, Z_LAYER.box) < stackZ(2, Z_LAYER.you));
  assert.ok(stackZ(2, Z_LAYER.wall) < stackZ(2, Z_LAYER.you));
});

test('next row actors sit above this row you', () => {
  assert.equal(stackZ(0, Z_LAYER.you), 19);
  assert.equal(stackZ(1, Z_LAYER.door), 23);
  assert.ok(stackZ(0, Z_LAYER.you) < stackZ(1, Z_LAYER.door));
});

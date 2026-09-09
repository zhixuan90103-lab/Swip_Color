import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Z_LAYER } from './boardStack';

function z(row: number, layer: number): number {
  return (row + 1) * 10 + layer;
}

test('same row: door under star under actor', () => {
  assert.ok(z(2, Z_LAYER.door) < z(2, Z_LAYER.star));
  assert.ok(z(2, Z_LAYER.star) < z(2, Z_LAYER.actor));
  assert.ok(z(2, Z_LAYER.glow) < z(2, Z_LAYER.door));
});

test('next row sits above this row actors', () => {
  assert.equal(z(0, Z_LAYER.actor), 15);
  assert.equal(z(1, Z_LAYER.door), 23);
  assert.ok(z(0, Z_LAYER.actor) < z(1, Z_LAYER.door));
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOARD_RIM, TUNE_DEFAULT, layoutBoard, tokenPos } from './boardLayout';

test('tray size is independent of cell', () => {
  const a = layoutBoard(TUNE_DEFAULT, 5, 5);
  const b = layoutBoard({ ...TUNE_DEFAULT, cell: 80 }, 5, 5);
  assert.equal(a.boardW, b.boardW);
  assert.equal(a.boardH, b.boardH);
  assert.equal(a.slot, b.slot);
  assert.equal(a.originX, b.originX);
  assert.equal(a.originY, b.originY);
  assert.equal(a.gridW, b.gridW);
  assert.notEqual(a.cell, b.cell);
});

test('larger grids keep the level-1 slot and grow the tray', () => {
  const a = layoutBoard(TUNE_DEFAULT, 5, 5);
  const b = layoutBoard(TUNE_DEFAULT, 6, 6);
  assert.equal(a.slot, b.slot);
  assert.equal(a.cell, b.cell);
  assert.ok(b.boardW > a.boardW);
  assert.ok(b.boardH > a.boardH);
});

test('5x5 uses the template board size', () => {
  const L = layoutBoard(TUNE_DEFAULT, 5, 5);
  assert.equal(L.boardW, TUNE_DEFAULT.boardW);
  assert.equal(L.boardH, TUNE_DEFAULT.boardH);
});

test('grid is centered in the well', () => {
  const L = layoutBoard(TUNE_DEFAULT, 6, 5);
  const wellW = L.boardW - BOARD_RIM * 2;
  const wellH = L.boardH - BOARD_RIM * 2;
  assert.ok(Math.abs(L.originX * 2 + L.gridW - wellW) < 0.001);
  assert.ok(Math.abs(L.originY * 2 + L.gridH - wellH) < 0.001);
});

test('tokenPos is the slot center and ignores cell size', () => {
  const a = layoutBoard(TUNE_DEFAULT, 5, 5);
  const b = layoutBoard({ ...TUNE_DEFAULT, cell: 80 }, 5, 5);
  const pa = tokenPos(a, { r: 1, c: 2 });
  const pb = tokenPos(b, { r: 1, c: 2 });
  assert.equal(pa.x, pb.x);
  assert.equal(pa.y, pb.y);
  assert.equal(pa.x, 2 * (a.slot + a.gap) + a.slot / 2);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createObjectPool } from './objectPool';

test('reuses released instances', () => {
  let n = 0;
  const pool = createObjectPool({ create: () => ({ id: ++n }) });
  const a = pool.acquire();
  const b = pool.acquire();
  assert.equal(pool.liveCount(), 2);
  assert.notEqual(a, b);
  pool.release(a);
  assert.equal(pool.liveCount(), 1);
  assert.equal(pool.freeCount(), 1);
  const c = pool.acquire();
  assert.equal(c, a);
  assert.equal(n, 2);
});

test('releaseAll returns everyone to the free list', () => {
  const pool = createObjectPool({ create: () => ({}) });
  pool.acquire();
  pool.acquire();
  pool.releaseAll();
  assert.equal(pool.liveCount(), 0);
  assert.equal(pool.freeCount(), 2);
  pool.acquire();
  assert.equal(pool.liveCount(), 1);
  assert.equal(pool.freeCount(), 1);
});

test('double release is ignored', () => {
  const pool = createObjectPool({ create: () => ({}) });
  const a = pool.acquire();
  pool.release(a);
  pool.release(a);
  assert.equal(pool.freeCount(), 1);
});

test('DOM park class is added on release and cleared on acquire', () => {
  const parked: string[] = [];
  const el = { flag: '' };
  const pool = createObjectPool({
    create: () => el,
    onAcquire: (item) => {
      item.flag = 'live';
    },
    onRelease: (item) => {
      item.flag = 'pooled';
      parked.push(item.flag);
    },
  });
  const a = pool.acquire();
  assert.equal(a.flag, 'live');
  pool.release(a);
  assert.equal(a.flag, 'pooled');
  pool.acquire();
  assert.equal(el.flag, 'live');
});

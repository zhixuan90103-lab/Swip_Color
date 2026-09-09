/**
 * Reuse instances on the hot path.
 * DOM nodes stay in the tree; parked nodes use class `is-pooled`
 * (display:none !important). Never use the `hidden` attribute — author
 * `display:flex` beats the UA [hidden] rule and leftover pieces show at 0,0.
 */

export const POOLED_CLASS = 'is-pooled';

export type ObjectPool<T> = {
  acquire: () => T;
  release: (item: T) => void;
  releaseAll: () => void;
  liveCount: () => number;
  freeCount: () => number;
};

export function createObjectPool<T>(opts: {
  create: () => T;
  onAcquire?: (item: T) => void;
  onRelease?: (item: T) => void;
}): ObjectPool<T> {
  const free: T[] = [];
  const live = new Set<T>();
  return {
    acquire() {
      const item = free.pop() ?? opts.create();
      live.add(item);
      opts.onAcquire?.(item);
      return item;
    },
    release(item) {
      if (!live.delete(item)) return;
      opts.onRelease?.(item);
      free.push(item);
    },
    releaseAll() {
      for (const item of live) {
        opts.onRelease?.(item);
        free.push(item);
      }
      live.clear();
    },
    liveCount: () => live.size,
    freeCount: () => free.length,
  };
}

export type DomPool = ObjectPool<HTMLElement>;

export function createDomPool(opts: {
  parent: HTMLElement;
  create: () => HTMLElement;
  reset?: (el: HTMLElement) => void;
}): DomPool {
  return createObjectPool({
    create: opts.create,
    onAcquire(el) {
      el.classList.remove(POOLED_CLASS);
      if (el.parentElement !== opts.parent) opts.parent.appendChild(el);
    },
    onRelease(el) {
      opts.reset?.(el);
      el.classList.add(POOLED_CLASS);
    },
  });
}

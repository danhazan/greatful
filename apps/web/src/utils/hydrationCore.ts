/**
 * Shared primitives for hydration/validation batching.
 *
 * Each domain (user profile hydration, username validation) owns its
 * own instances of these factories.  No cross-domain state is shared.
 */

export function createCache<V>() {
  const store = new Map<number | string, V>()
  return {
    get(key: number | string): V | undefined { return store.get(key) },
    set(key: number | string, value: V): void { store.set(key, value) },
    has(key: number | string): boolean { return store.has(key) },
    delete(key: number | string): boolean { return store.delete(key) },
    clear(): void { store.clear() },
  }
}

export function createInflightTracker() {
  const pending = new Map<number | string, Promise<void>>()
  return {
    track(key: number | string, promise: Promise<void>): void {
      pending.set(key, promise)
    },
    waitFor(key: number | string): Promise<void> | undefined {
      return pending.get(key)
    },
    isPending(key: number | string): boolean {
      return pending.has(key)
    },
    untrack(key: number | string): void {
      pending.delete(key)
    },
    clear(): void {
      pending.clear()
    },
  }
}

export interface BatcherEntry<T> {
  keys: T[]
  resolve: (...args: any[]) => void
  reject: (err: unknown) => void
}

export function createMicrotaskBatcher<T>(
  process: (
    batch: T[],
    entries: BatcherEntry<T>[]
  ) => void | Promise<void>
) {
  const queue = new Set<T>()
  let entries: BatcherEntry<T>[] = []
  let scheduled = false

  function enqueue(
    keys: T[],
    resolve: (...args: any[]) => void,
    reject: (err: unknown) => void
  ): void {
    for (const key of keys) {
      queue.add(key)
    }
    entries.push({ keys, resolve, reject })
    if (!scheduled) {
      scheduled = true
      queueMicrotask(flush)
    }
  }

  async function flush(): Promise<void> {
    scheduled = false
    const batch = [...queue]
    queue.clear()
    const currentEntries = entries
    entries = []

    if (batch.length === 0) {
      for (const entry of currentEntries) entry.resolve()
      return
    }

    try {
      await process(batch, currentEntries)
    } catch (err) {
      for (const entry of currentEntries) entry.reject(err)
    }
  }

  return { enqueue }
}

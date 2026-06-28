import { apiClient } from './apiClient'
import { normalizeToUserSearchResult } from './userDataMapping'
import { UserSearchResult } from '@/types/userSearch'
import {
  createCache,
  createInflightTracker,
  createMicrotaskBatcher,
} from './hydrationCore'

// ── User profile hydration domain ────────────────────────────────────

const idCache = createCache<UserSearchResult>()
const idInflight = createInflightTracker()

let totalCalls = 0
let cacheHits = 0
let totalBatchedIds = 0
let actualFetchedIds = 0

function logStats() {
  const hitRate =
    totalCalls > 0 ? ((cacheHits / totalBatchedIds) * 100).toFixed(1) : '0.0'
  const reduction =
    totalBatchedIds > 0
      ? ((1 - actualFetchedIds / totalBatchedIds) * 100).toFixed(1)
      : '0.0'
  console.log(
    `[hydration] cache hit: ${hitRate}%, batch size reduction: ${reduction}%`
  )
}

async function fetchUserBatch(userIds: number[]): Promise<void> {
  const fetchPromise = (async () => {
    try {
      const data = (await apiClient.post('/users/batch-profiles', {
        user_ids: userIds,
      })) as any
      const results = data?.data || data || []
      if (Array.isArray(results)) {
        const normalized = results.map(normalizeToUserSearchResult)
        for (const user of normalized) {
          idCache.set(user.id, user)
        }
      }
    } catch {
      // On failure, pending entries are removed so callers retry
    } finally {
      for (const id of userIds) {
        idInflight.untrack(id)
      }
    }
  })()

  for (const id of userIds) {
    idInflight.track(id, fetchPromise)
  }

  await fetchPromise
}

const idBatcher = createMicrotaskBatcher<number>(
  async (batch, entries) => {
    totalCalls += entries.length
    totalBatchedIds += batch.length

    const missing: number[] = []
    const pending: Promise<void>[] = []

    for (const id of batch) {
      if (idCache.has(id)) {
        cacheHits++
        continue
      }
      const existing = idInflight.waitFor(id)
      if (existing) {
        pending.push(existing)
      } else {
        missing.push(id)
      }
    }

    if (missing.length > 0) {
      actualFetchedIds += missing.length
      pending.push(fetchUserBatch(missing))
    }

    if (pending.length > 0) {
      await Promise.all(pending)
    }

    if (totalCalls % 10 === 0) {
      logStats()
    }

    for (const entry of entries) {
      const users = entry.keys
        .map((id) => idCache.get(id) ?? null)
        .filter((u): u is UserSearchResult => u !== null)
      entry.resolve(users)
    }
  }
)

export async function hydrateUserIds(
  ids: number[]
): Promise<UserSearchResult[]> {
  if (ids.length === 0) return []

  const uniqueIds = [...new Set(ids)]

  return new Promise<UserSearchResult[]>((resolve, reject) => {
    idBatcher.enqueue(uniqueIds, resolve, reject)
  })
}

// ── Username validation domain ───────────────────────────────────────

const nameCache = createCache<boolean>()
const nameInflight = createInflightTracker()

let nameCalls = 0
let nameCacheHits = 0
let nameBatched = 0
let nameFetched = 0

async function fetchNameBatch(usernames: string[]): Promise<void> {
  const fetchPromise = (async () => {
    try {
      const data = (await apiClient.post('/users/validate-batch', {
        usernames,
      })) as any
      const valid: string[] =
        data?.data?.validUsernames || data?.validUsernames || []
      const validSet = new Set(valid)
      for (const username of usernames) {
        nameCache.set(username, validSet.has(username))
      }
    } catch {
      // On failure, pending entries are removed so callers retry
    } finally {
      for (const username of usernames) {
        nameInflight.untrack(username)
      }
    }
  })()

  for (const username of usernames) {
    nameInflight.track(username, fetchPromise)
  }

  await fetchPromise
}

const nameBatcher = createMicrotaskBatcher<string>(
  async (batch, entries) => {
    nameCalls += entries.length
    nameBatched += batch.length

    const missing: string[] = []
    const pending: Promise<void>[] = []

    for (const username of batch) {
      if (nameCache.has(username)) {
        nameCacheHits++
        continue
      }
      const existing = nameInflight.waitFor(username)
      if (existing) {
        pending.push(existing)
      } else {
        missing.push(username)
      }
    }

    if (missing.length > 0) {
      nameFetched += missing.length
      pending.push(fetchNameBatch(missing))
    }

    if (pending.length > 0) {
      await Promise.all(pending)
    }

    if (nameCalls % 10 === 0) {
      const hitRate =
        nameCalls > 0 ? ((nameCacheHits / nameBatched) * 100).toFixed(1) : '0.0'
      const reduction =
        nameBatched > 0
          ? ((1 - nameFetched / nameBatched) * 100).toFixed(1)
          : '0.0'
      console.log(
        `[name-validation] cache hit: ${hitRate}%, batch reduction: ${reduction}%`
      )
    }

    for (const entry of entries) {
      const valid = entry.keys.filter(
        (u) => nameCache.get(u) === true
      )
      entry.resolve(valid)
    }
  }
)

export async function validateUsernames(
  usernames: string[]
): Promise<string[]> {
  if (usernames.length === 0) return []

  const unique = [...new Set(usernames)]

  return new Promise<string[]>((resolve, reject) => {
    nameBatcher.enqueue(unique, resolve, reject)
  })
}

export function clearUserHydrationCache(): void {
  idCache.clear()
  idInflight.clear()
  nameCache.clear()
  nameInflight.clear()
  totalCalls = 0
  cacheHits = 0
  totalBatchedIds = 0
  actualFetchedIds = 0
  nameCalls = 0
  nameCacheHits = 0
  nameBatched = 0
  nameFetched = 0
}

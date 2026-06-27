import { apiClient } from './apiClient'
import { normalizeToUserSearchResult } from './userDataMapping'
import { UserSearchResult } from '@/types/userSearch'

const userCache = new Map<number, UserSearchResult>()
const pendingFetches = new Map<number, Promise<void>>()

let totalCalls = 0
let cacheHits = 0
let totalBatchedIds = 0
let actualFetchedIds = 0

function logStats() {
  const hitRate = totalCalls > 0 ? ((cacheHits / totalBatchedIds) * 100).toFixed(1) : '0.0'
  const reduction = totalBatchedIds > 0
    ? ((1 - actualFetchedIds / totalBatchedIds) * 100).toFixed(1)
    : '0.0'
  console.log(
    `[hydration] cache hit: ${hitRate}%, batch size reduction: ${reduction}%`
  )
}

async function fetchBatch(userIds: number[]): Promise<void> {
  const fetchPromise = (async () => {
    try {
      const data = (await apiClient.post('/users/batch-profiles', {
        user_ids: userIds,
      })) as any
      const results = data?.data || data || []
      if (Array.isArray(results)) {
        const normalized = results.map(normalizeToUserSearchResult)
        for (const user of normalized) {
          userCache.set(user.id, user)
        }
      }
    } catch {
      // On failure, pending entries are removed so callers retry
    } finally {
      for (const id of userIds) {
        pendingFetches.delete(id)
      }
    }
  })()

  for (const id of userIds) {
    pendingFetches.set(id, fetchPromise)
  }

  await fetchPromise
}

interface QueueEntry {
  ids: number[]
  resolve: (users: UserSearchResult[]) => void
  reject: (err: unknown) => void
}

const pendingQueue = new Set<number>()
const queueEntries: QueueEntry[] = []
let flushScheduled = false

function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true
  queueMicrotask(flushQueue)
}

async function flushQueue(): Promise<void> {
  flushScheduled = false
  const queuedIds = [...pendingQueue]
  pendingQueue.clear()
  const entries = queueEntries.splice(0)

  if (queuedIds.length === 0) {
    for (const entry of entries) entry.resolve([])
    return
  }

  const uniqueIds = [...new Set(queuedIds)]
  totalCalls += entries.length
  totalBatchedIds += uniqueIds.length

  const missing: number[] = []
  const pending: Promise<void>[] = []

  for (const id of uniqueIds) {
    if (userCache.has(id)) {
      cacheHits++
      continue
    }
    const existing = pendingFetches.get(id)
    if (existing) {
      pending.push(existing)
    } else {
      missing.push(id)
    }
  }

  if (missing.length > 0) {
    actualFetchedIds += missing.length
    pending.push(fetchBatch(missing))
  }

  if (pending.length > 0) {
    await Promise.all(pending)
  }

  if (totalCalls % 10 === 0) {
    logStats()
  }

  for (const entry of entries) {
    const users = entry.ids
      .map((id) => userCache.get(id) ?? null)
      .filter((u): u is UserSearchResult => u !== null)
    entry.resolve(users)
  }
}

export async function hydrateUserIds(
  ids: number[]
): Promise<UserSearchResult[]> {
  if (ids.length === 0) return []

  const uniqueIds = [...new Set(ids)]

  return new Promise<UserSearchResult[]>((resolve, reject) => {
    for (const id of uniqueIds) {
      pendingQueue.add(id)
    }
    queueEntries.push({ ids: uniqueIds, resolve, reject })
    scheduleFlush()
  })
}

// --- Username validation (same coalescing pattern) ---

const validUsernameCache = new Map<string, boolean>()
const pendingValidations = new Map<string, Promise<void>>()

interface ValidationEntry {
  usernames: string[]
  resolve: (valid: string[]) => void
  reject: (err: unknown) => void
}

const validationQueue = new Set<string>()
const validationEntries: ValidationEntry[] = []
let validationFlushScheduled = false

function scheduleValidationFlush(): void {
  if (validationFlushScheduled) return
  validationFlushScheduled = true
  queueMicrotask(flushValidationQueue)
}

async function fetchValidationBatch(usernames: string[]): Promise<void> {
  const fetchPromise = (async () => {
    try {
      const data = (await apiClient.post('/users/validate-batch', {
        usernames,
      })) as any
      const valid: string[] =
        data?.data?.validUsernames || data?.validUsernames || []
      const validSet = new Set(valid)
      for (const username of usernames) {
        validUsernameCache.set(username, validSet.has(username))
      }
    } catch {
      // On failure, pending entries are removed so callers retry
    } finally {
      for (const username of usernames) {
        pendingValidations.delete(username)
      }
    }
  })()

  for (const username of usernames) {
    pendingValidations.set(username, fetchPromise)
  }

  await fetchPromise
}

async function flushValidationQueue(): Promise<void> {
  validationFlushScheduled = false
  const queued = [...validationQueue]
  validationQueue.clear()
  const entries = validationEntries.splice(0)

  if (queued.length === 0) {
    for (const entry of entries) entry.resolve([])
    return
  }

  const uniqueUsernames = [...new Set(queued)]

  const missing: string[] = []
  const pending: Promise<void>[] = []

  for (const username of uniqueUsernames) {
    if (validUsernameCache.has(username)) continue
    const existing = pendingValidations.get(username)
    if (existing) {
      pending.push(existing)
    } else {
      missing.push(username)
    }
  }

  if (missing.length > 0) {
    pending.push(fetchValidationBatch(missing))
  }

  if (pending.length > 0) {
    await Promise.all(pending)
  }

  for (const entry of entries) {
    const valid = entry.usernames.filter(
      (u) => validUsernameCache.get(u) === true
    )
    entry.resolve(valid)
  }
}

export async function validateUsernames(
  usernames: string[]
): Promise<string[]> {
  if (usernames.length === 0) return []

  const unique = [...new Set(usernames)]

  return new Promise<string[]>((resolve, reject) => {
    for (const username of unique) {
      validationQueue.add(username)
    }
    validationEntries.push({ usernames: unique, resolve, reject })
    scheduleValidationFlush()
  })
}

export function clearUserHydrationCache(): void {
  userCache.clear()
  pendingFetches.clear()
  pendingQueue.clear()
  queueEntries.splice(0)
  flushScheduled = false
  validUsernameCache.clear()
  pendingValidations.clear()
  validationQueue.clear()
  validationEntries.splice(0)
  validationFlushScheduled = false
  totalCalls = 0
  cacheHits = 0
  totalBatchedIds = 0
  actualFetchedIds = 0
}

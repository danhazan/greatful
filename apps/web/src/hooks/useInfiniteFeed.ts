'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiClient } from '@/utils/apiClient'
import { normalizePostFromApi } from '@/utils/normalizePost'
import { Post } from '@/types/post'
import { requestDeduplicator } from '@/utils/requestDeduplicator'

type FeedPageResponse = {
  posts: any[]
  nextCursor: string | null
}

export type FeedFilterKey = 'mine' | 'followed' | 'followers' | 'public' | 'images' | 'today' | 'last_3_days' | 'last_week'
export type FeedFilterMode = 'off' | 'boost' | 'required'

export interface FeedFiltersPayload {
  requiredFilters: FeedFilterKey[]
  boostFilters: FeedFilterKey[]
}

interface UseInfiniteFeedOptions {
  enabled: boolean
  currentUserId?: string
  onPostsLoaded?: (posts: Post[]) => void
  feedFilters?: FeedFiltersPayload
}

interface UseInfiniteFeedResult {
  items: Post[]
  nextCursor: string | null
  hasMore: boolean
  isInitialLoading: boolean
  isFetchingNextPage: boolean
  isRefreshing: boolean
  error: Error | null
  refresh: (reason?: string, options?: { preserveExistingItems?: boolean }) => Promise<void>
  loadNextPage: () => Promise<void>
  patchPost: (postId: string, updater: (post: Post) => Post) => void
  removePost: (postId: string) => void
}

function debugLog(event: string, payload: Record<string, unknown>) {
  if (process.env['NODE_ENV'] !== 'development') return
  console.debug(`[FEED] ${event}`, payload)
}

function extractPostPrivacy(post: any): {
  privacyLevel?: 'public' | 'private' | 'custom'
  privacyRules?: string[]
  specificUsers?: number[]
} {
  const privacyLevelRaw = post?.privacyLevel
  const privacyRulesRaw = post?.privacyRules
  const specificUsersRaw = post?.specificUsers

  return {
    privacyLevel:
      privacyLevelRaw === 'public' || privacyLevelRaw === 'private' || privacyLevelRaw === 'custom'
        ? privacyLevelRaw
        : undefined,
    privacyRules: Array.isArray(privacyRulesRaw) ? privacyRulesRaw : undefined,
    specificUsers: Array.isArray(specificUsersRaw) ? specificUsersRaw : undefined,
  }
}

function dedupeIncomingPage(posts: Post[]) {
  const pageSeenIds = new Set<string>()
  const uniquePagePosts: Post[] = []
  let duplicateCount = 0

  posts.forEach((post) => {
    if (pageSeenIds.has(post.id)) {
      duplicateCount += 1
      return
    }

    pageSeenIds.add(post.id)
    uniquePagePosts.push(post)
  })

  return { uniquePagePosts, duplicateCount }
}

function mergeFeedItems(existingItems: Post[], incomingPosts: Post[], seenIds: Set<string>) {
  const incomingById = new Map<string, Post>()
  incomingPosts.forEach((post) => {
    incomingById.set(post.id, post)
  })

  const existingIds = new Set(existingItems.map((post) => post.id))
  const mergedExisting = existingItems.map((post) => incomingById.get(post.id) ?? post)
  const newUniquePosts: Post[] = []
  let alreadySeenCount = 0

  incomingPosts.forEach((post) => {
    if (existingIds.has(post.id) || seenIds.has(post.id)) {
      alreadySeenCount += 1
      return
    }

    seenIds.add(post.id)
    newUniquePosts.push(post)
  })

  return {
    items: [...mergedExisting, ...newUniquePosts],
    addedCount: newUniquePosts.length,
    duplicateCount: alreadySeenCount,
  }
}

function buildFeedQuery(cursor: string | null, filters?: FeedFiltersPayload): string {
  const params = new URLSearchParams()
  params.set('page_size', '10')

  if (cursor) {
    params.set('cursor', cursor)
  }

  for (const filterName of filters?.requiredFilters ?? []) {
    params.append('required_filters', filterName)
  }
  for (const filterName of filters?.boostFilters ?? []) {
    params.append('boost_filters', filterName)
  }

  return `/posts?${params.toString()}`
}

export function useInfiniteFeed({
  enabled,
  currentUserId,
  onPostsLoaded,
  feedFilters,
}: UseInfiniteFeedOptions): UseInfiniteFeedResult {
  const [items, setItems] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(false)
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const itemsRef = useRef<Post[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const requestedCursorsRef = useRef<Set<string>>(new Set())
  const sessionVersionRef = useRef(0)
  const activePaginationCursorRef = useRef<string | null>(null)
  const lastResolvedCursorRef = useRef<string | null>(null)
  const repeatCursorCountRef = useRef(0)
  const noProgressCountRef = useRef(0)
  const observerCursorGateRef = useRef<string | null>(null)
  const initialLoadStartedRef = useRef(false)
  const isRefreshingRef = useRef(false)
  const lastRefreshAtRef = useRef(0)
  const filterChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastFilterSignatureRef = useRef<string | null>(null)

  itemsRef.current = items

  const hydratePrivacy = useCallback(async (normalizedPosts: Post[], refresh: boolean): Promise<Post[]> => {
    if (!currentUserId) return normalizedPosts

    const needsHydration = normalizedPosts.some(
      (post) => post.author?.id === currentUserId && !post.privacyLevel
    )

    if (!needsHydration) return normalizedPosts

    try {
      const myPostsResponse = await apiClient.get('/users/me/posts', { skipCache: refresh }) as any
      const myPosts = myPostsResponse?.data || myPostsResponse
      if (!Array.isArray(myPosts)) return normalizedPosts

      const privacyByPostId = new Map<string, { privacyLevel?: 'public' | 'private' | 'custom'; privacyRules?: string[]; specificUsers?: number[] }>()
      myPosts.forEach((myPost: any) => {
        const postId = String(myPost?.id || '')
        if (postId) {
          privacyByPostId.set(postId, extractPostPrivacy(myPost))
        }
      })

      return normalizedPosts.map((post) => {
        if (post.author?.id !== currentUserId) return post
        const privacy = privacyByPostId.get(post.id)
        if (!privacy) return post

        return {
          ...post,
          privacyLevel: privacy.privacyLevel ?? post.privacyLevel,
          privacyRules: privacy.privacyRules ?? post.privacyRules,
          specificUsers: privacy.specificUsers ?? post.specificUsers,
        }
      })
    } catch {
      console.warn('[Feed] Failed to hydrate own post privacy metadata')
      return normalizedPosts
    }
  }, [currentUserId])

  const fetchPage = useCallback(async (cursor: string | null, refresh: boolean): Promise<FeedPageResponse> => {
    const query = buildFeedQuery(cursor, feedFilters)
    const data = await apiClient.get<{ posts: any[]; nextCursor: string | null }>(query, {
      skipCache: true,
    })

    const rawPosts = (data as any)?.posts ?? (data as any)?.data?.posts ?? []
    if (!Array.isArray(rawPosts)) {
      throw new Error('Invalid posts data format')
    }

    const normalizedPosts = rawPosts
      .map((post: any) => normalizePostFromApi(post))
      .filter(Boolean) as Post[]
    const hydratedPosts = await hydratePrivacy(normalizedPosts, refresh)

    return {
      posts: hydratedPosts,
      nextCursor: (data as any)?.nextCursor ?? (data as any)?.data?.nextCursor ?? null,
    }
  }, [feedFilters, hydratePrivacy])
  const feedFilterSignature = JSON.stringify(feedFilters || { requiredFilters: [], boostFilters: [] })
  
  const resetSessionState = useCallback((options?: { clearItems?: boolean }) => {
    const clearItems = options?.clearItems ?? true
    seenIdsRef.current = new Set()
    requestedCursorsRef.current = new Set()
    activePaginationCursorRef.current = null
    lastResolvedCursorRef.current = null
    repeatCursorCountRef.current = 0
    noProgressCountRef.current = 0
    observerCursorGateRef.current = null
    if (clearItems) {
      itemsRef.current = []
      setItems([])
    }
    setNextCursor(null)
    setHasMore(false)
    setIsRefreshing(false)
    setError(null)
  }, [])

  const stopPagination = useCallback((reason: string, context: Record<string, unknown> = {}) => {
    debugLog('stop pagination', { reason, ...context })
    setHasMore(false)
    setNextCursor(null)
    activePaginationCursorRef.current = null
  }, [])

  const runSessionLoad = useCallback(async (
    refresh: boolean,
    reason: string,
    options?: { preserveExistingItems?: boolean }
  ) => {
    const preserveExistingItems = options?.preserveExistingItems ?? false
    const sessionVersion = sessionVersionRef.current + 1
    sessionVersionRef.current = sessionVersion
    initialLoadStartedRef.current = true
    debugLog(refresh ? 'refresh start' : 'initial load start', { sessionVersion, reason, timestamp: Date.now() })
    requestDeduplicator.cancel('/api/posts')
    resetSessionState({ clearItems: !preserveExistingItems })
    setIsInitialLoading(true)
    if (refresh) {
      isRefreshingRef.current = true
      lastRefreshAtRef.current = Date.now()
      setIsRefreshing(true)
    }

    try {
      const page = await fetchPage(null, refresh)
      if (sessionVersion !== sessionVersionRef.current) {
        debugLog('drop stale initial page', { sessionVersion })
        return
      }

      const { uniquePagePosts, duplicateCount: pageDuplicateCount } = dedupeIncomingPage(page.posts)
      uniquePagePosts.forEach((post) => seenIdsRef.current.add(post.id))
      itemsRef.current = uniquePagePosts
      setItems(uniquePagePosts)
      onPostsLoaded?.(uniquePagePosts)
      setError(null)

      const next = page.nextCursor ?? null
      const noItems = uniquePagePosts.length === 0

      if (noItems || !next) {
        stopPagination(noItems ? 'no-items' : 'no-next-cursor', {
          sessionVersion,
          duplicateFiltered: pageDuplicateCount,
        })
      } else {
        setHasMore(true)
        setNextCursor(next)
        lastResolvedCursorRef.current = next
        observerCursorGateRef.current = null
        debugLog('merged initial page', {
          sessionVersion,
          added: uniquePagePosts.length,
          total: uniquePagePosts.length,
          duplicateFiltered: pageDuplicateCount,
          nextCursor: next,
        })
      }
    } catch (fetchError) {
      if (sessionVersion !== sessionVersionRef.current) {
        return
      }

      setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)))
      stopPagination('initial-load-error', { sessionVersion })
    } finally {
      if (sessionVersion === sessionVersionRef.current) {
        setIsInitialLoading(false)
        debugLog(refresh ? 'refresh end' : 'initial load end', {
          sessionVersion,
          reason,
          timestamp: Date.now(),
          total: itemsRef.current.length,
          nextCursor: lastResolvedCursorRef.current,
          hasMore: !!lastResolvedCursorRef.current,
        })
        if (refresh) {
          isRefreshingRef.current = false
          setIsRefreshing(false)
        }
      }
    }
  }, [fetchPage, onPostsLoaded, resetSessionState, stopPagination])

  const loadNextPage = useCallback(async () => {
    const cursor = nextCursor
    if (!enabled || !cursor || !hasMore) return
    if (activePaginationCursorRef.current) return
    if (requestedCursorsRef.current.has(cursor)) return
    if (observerCursorGateRef.current === cursor) return

    observerCursorGateRef.current = cursor
    activePaginationCursorRef.current = cursor
    requestedCursorsRef.current.add(cursor)
    setIsFetchingNextPage(true)

    const sessionVersion = sessionVersionRef.current
    debugLog('loadNextPage triggered', { cursor, sessionVersion, timestamp: Date.now() })

    try {
      const page = await fetchPage(cursor, false)
      if (sessionVersion !== sessionVersionRef.current) {
        debugLog('drop stale paginated page', { cursor, sessionVersion })
        return
      }

      const { uniquePagePosts, duplicateCount: pageDuplicateCount } = dedupeIncomingPage(page.posts)
      const mergeResult = mergeFeedItems(itemsRef.current, uniquePagePosts, seenIdsRef.current)
      const next = page.nextCursor ?? null
      const repeatedCursor = !!next && (next === cursor || next === lastResolvedCursorRef.current)

      if (mergeResult.addedCount === 0) {
        noProgressCountRef.current += 1
        console.warn('[FEED] pagination stalled', {
          cursor,
          sessionVersion,
          noProgressCount: noProgressCountRef.current,
        })
      } else {
        noProgressCountRef.current = 0
      }

      if (repeatedCursor) {
        repeatCursorCountRef.current += 1
      } else {
        repeatCursorCountRef.current = 0
      }

      setItems(mergeResult.items)
      itemsRef.current = mergeResult.items
      if (uniquePagePosts.length > 0) {
        onPostsLoaded?.(uniquePagePosts)
      }

      debugLog('merged page', {
        cursor,
        sessionVersion,
        added: mergeResult.addedCount,
        total: mergeResult.items.length,
        duplicateFiltered: pageDuplicateCount + mergeResult.duplicateCount,
        noProgressCount: noProgressCountRef.current,
        nextCursor: next,
      })

      const stopReason =
        uniquePagePosts.length === 0 ? 'empty-page' :
        mergeResult.addedCount === 0 ? 'no-new-unique-ids' :
        !next ? 'no-next-cursor' :
        repeatedCursor ? 'repeated-cursor' :
        null

      if (stopReason) {
        stopPagination(stopReason, {
          cursor,
          sessionVersion,
          nextCursor: next,
          repeatCursorCount: repeatCursorCountRef.current,
        })
        return
      }

      setHasMore(true)
      setNextCursor(next)
      lastResolvedCursorRef.current = next
      observerCursorGateRef.current = null
    } catch (fetchError) {
      if (sessionVersion !== sessionVersionRef.current) {
        return
      }

      setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)))
      debugLog('loadNextPage error', { cursor, sessionVersion })
    } finally {
      if (sessionVersion === sessionVersionRef.current) {
        activePaginationCursorRef.current = null
        setIsFetchingNextPage(false)
      }
    }
  }, [enabled, fetchPage, hasMore, nextCursor, onPostsLoaded, stopPagination])

  const refresh = useCallback(async (reason: string = 'manual', options?: { preserveExistingItems?: boolean }) => {
    debugLog('refresh triggered', {
      reason,
      timestamp: Date.now(),
      isRefreshing: isRefreshingRef.current,
      lastRefreshAt: lastRefreshAtRef.current,
    })

    if (isRefreshingRef.current) {
      debugLog('refresh skipped', { reason, skipReason: 'already-refreshing', timestamp: Date.now() })
      return
    }

    if (reason !== 'post-create' && Date.now() - lastRefreshAtRef.current < 750) {
      debugLog('refresh skipped', { reason, skipReason: 'cooldown', timestamp: Date.now() })
      return
    }

    await runSessionLoad(true, reason, {
      preserveExistingItems: options?.preserveExistingItems ?? false,
    })
  }, [runSessionLoad])

  const patchPost = useCallback((postId: string, updater: (post: Post) => Post) => {
    setItems((previousItems) => {
      const nextItems = previousItems.map((post) => {
        if (post.id !== postId) return post
        return updater(post)
      })
      itemsRef.current = nextItems
      return nextItems
    })
  }, [])

  const removePost = useCallback((postId: string) => {
    setItems((previousItems) => {
      const nextItems = previousItems.filter((post) => post.id !== postId)
      itemsRef.current = nextItems
      seenIdsRef.current.delete(postId)
      return nextItems
    })
  }, [])

  useEffect(() => {
    if (!enabled) {
      sessionVersionRef.current += 1
      initialLoadStartedRef.current = false
      setIsInitialLoading(false)
      setIsFetchingNextPage(false)
      resetSessionState()
      return
    }

    if (initialLoadStartedRef.current) return
    void runSessionLoad(false, 'initial-load')
  }, [enabled, resetSessionState, runSessionLoad])
  useEffect(() => {
    if (!enabled) return

    if (lastFilterSignatureRef.current === null) {
      lastFilterSignatureRef.current = feedFilterSignature
      return
    }

    if (lastFilterSignatureRef.current === feedFilterSignature) return
    lastFilterSignatureRef.current = feedFilterSignature

    if (filterChangeTimeoutRef.current) {
      clearTimeout(filterChangeTimeoutRef.current)
    }

    filterChangeTimeoutRef.current = setTimeout(() => {
      void refresh('filter-change', { preserveExistingItems: true })
    }, 400)

    return () => {
      if (filterChangeTimeoutRef.current) {
        clearTimeout(filterChangeTimeoutRef.current)
      }
    }
  }, [enabled, feedFilterSignature, refresh])
  
  return {
    items,
    nextCursor,
    hasMore,
    isInitialLoading,
    isFetchingNextPage,
    isRefreshing,
    error,
    refresh,
    loadNextPage,
    patchPost,
    removePost,
  }
}

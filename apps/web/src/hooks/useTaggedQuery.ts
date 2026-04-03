'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  canonicalizeTags,
  QueryKey,
  QueryPolicy,
  RefetchReason,
  serializeQueryKey,
  serializeQueryTags,
  taggedQueryCache,
} from '@/utils/apiCache'

interface UseTaggedQueryOptions<TData, TSelected = TData> {
  queryKey: QueryKey
  tags: string[]
  policy: QueryPolicy
  fetcher: () => Promise<TData>
  enabled?: boolean
  viewerScope?: string
  select?: (data: TData) => TSelected
}

interface UseTaggedQueryResult<TSelected> {
  data: TSelected | undefined
  error: Error | null
  isLoading: boolean
  isFetching: boolean
  isStale: boolean
  refetch: () => Promise<void>
}

function debugLog(event: string, payload: Record<string, unknown>) {
  if (process.env['NODE_ENV'] !== 'development') return
  console.debug(`[useTaggedQuery] ${event}`, payload)
}

export function useTaggedQuery<TData, TSelected = TData>({
  queryKey,
  tags,
  policy,
  fetcher,
  enabled = true,
  viewerScope,
  select,
}: UseTaggedQueryOptions<TData, TSelected>): UseTaggedQueryResult<TSelected> {
  const normalizedTags = useMemo(() => canonicalizeTags(tags), [serializeQueryTags(tags)])
  const queryKeyId = serializeQueryKey(queryKey)
  const tagsId = serializeQueryTags(normalizedTags)
  const snapshot = taggedQueryCache.getSnapshot<TData>(queryKey, normalizedTags, viewerScope)
  const [data, setData] = useState<TData | undefined>(snapshot.data)
  const [error, setError] = useState<Error | null>(snapshot.error)
  const [isFetching, setIsFetching] = useState(false)
  const [isLoading, setIsLoading] = useState(enabled && snapshot.data === undefined)
  const mountedRef = useRef(false)
  const latestQueryKeyRef = useRef(queryKey)
  const latestTagsRef = useRef(normalizedTags)
  const latestViewerScopeRef = useRef(viewerScope)
  const latestEnabledRef = useRef(enabled)
  const fetcherRef = useRef(fetcher)
  latestQueryKeyRef.current = queryKey
  latestTagsRef.current = normalizedTags
  latestViewerScopeRef.current = viewerScope
  latestEnabledRef.current = enabled
  fetcherRef.current = fetcher

  const applySelected = useCallback((nextData: TData | undefined) => {
    if (typeof nextData === 'undefined') return undefined
    return select ? select(nextData) : (nextData as unknown as TSelected)
  }, [select])

  const performFetch = useCallback(async (reason: RefetchReason) => {
    if (!latestEnabledRef.current) return

    const currentQueryKey = latestQueryKeyRef.current
    const currentTags = latestTagsRef.current
    const currentViewerScope = latestViewerScopeRef.current
    const requestVersion = taggedQueryCache.getVersion(currentQueryKey, currentTags, currentViewerScope)
    const currentSnapshot = taggedQueryCache.getSnapshot<TData>(currentQueryKey, currentTags, currentViewerScope)

    if (mountedRef.current) {
      setIsFetching(true)
      if (typeof currentSnapshot.data === 'undefined') {
        setIsLoading(true)
      }
    }

    debugLog('refetch', { queryKey: currentQueryKey, reason, requestVersion })

    try {
      const result = await taggedQueryCache.runWithInFlight<TData>(currentQueryKey, currentTags, {
        viewerScope: currentViewerScope,
        version: requestVersion,
        fetcher: () => fetcherRef.current(),
      })

      const applied = taggedQueryCache.setData(currentQueryKey, currentTags, result, {
        viewerScope: currentViewerScope,
        version: requestVersion,
      })

      if (!applied) {
        debugLog('dropStaleResponse', { queryKey: currentQueryKey, reason, requestVersion })
        return
      }

      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      const queryError = err instanceof Error ? err : new Error(String(err))
      taggedQueryCache.setError(currentQueryKey, currentTags, queryError, {
        viewerScope: currentViewerScope,
        version: requestVersion,
      })

      if (mountedRef.current) {
        setError(queryError)
      }
    } finally {
      if (mountedRef.current) {
        setIsFetching(false)
        setIsLoading(false)
      }
    }
  }, [queryKeyId])

  useEffect(() => {
    mountedRef.current = true

    if (!enabled) {
      setIsLoading(false)
      return () => {
        mountedRef.current = false
      }
    }

    const unsubscribe = taggedQueryCache.subscribe(queryKey, normalizedTags, (reason) => {
      void performFetch(reason)
    }, viewerScope)

    const currentSnapshot = taggedQueryCache.getSnapshot<TData>(queryKey, normalizedTags, viewerScope)
    setData(currentSnapshot.data)
    setError(currentSnapshot.error)

    const shouldFetch =
      currentSnapshot.data === undefined ||
      currentSnapshot.stale ||
      policy === 'network-first'

    if (shouldFetch) {
      void performFetch(policy === 'network-first' ? 'policyBypass' : 'mount')
    } else {
      setIsLoading(false)
    }

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [enabled, performFetch, policy, queryKeyId, tagsId, viewerScope])

  const selectedData = useMemo(() => applySelected(data), [applySelected, data])
  const stale = taggedQueryCache.getSnapshot<TData>(queryKey, normalizedTags, viewerScope).stale

  return {
    data: selectedData,
    error,
    isLoading,
    isFetching,
    isStale: stale,
    refetch: () => performFetch('manual'),
  }
}

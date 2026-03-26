'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useToast } from '@/contexts/ToastContext'

export interface UseOptimisticMutationOptions<TSnapshot, TResult> {
  /** Capture current state before mutation — called inside execute(), not at hook setup */
  getSnapshot: () => TSnapshot
  /** Apply the optimistic UI update immediately */
  applyOptimistic: () => void
  /** The actual API call. Receives an AbortSignal for cancellation support. */
  apiCall: (signal: AbortSignal) => Promise<TResult>
  /** Called on success with the API result — use to reconcile with server data */
  onSuccess?: (result: TResult) => void
  /** Restore previous state on failure */
  rollback: (snapshot: TSnapshot) => void
  /** Error toast title (always visible, all environments) */
  errorTitle: string
  /** Error toast message — string or function that receives the error */
  errorMessage?: string | ((error: Error) => string)
  /** Show retry button on error toast (retry calls execute() again with fresh snapshot) */
  retryable?: boolean
  /** Dev/staging only — loading toast title */
  debugLoadingTitle?: string
  /** Dev/staging only — success toast title */
  debugSuccessTitle?: string
  /** Skip all toasts for this mutation (e.g. comments to prevent focus stealing) */
  skipToast?: boolean
  /** Skip only success/loading toasts but still show errors */
  skipDebugToast?: boolean
}

export interface UseOptimisticMutationReturn {
  /** Trigger the optimistic mutation */
  execute: () => Promise<void>
  /** Whether a request is currently in flight */
  isInFlight: boolean
  /** Cancel any in-flight request */
  cancel: () => void
}

export function useOptimisticMutation<TSnapshot, TResult = unknown>(
  options: UseOptimisticMutationOptions<TSnapshot, TResult>
): UseOptimisticMutationReturn {
  const {
    getSnapshot,
    applyOptimistic,
    apiCall,
    onSuccess,
    rollback,
    errorTitle,
    errorMessage,
    retryable = false,
    debugLoadingTitle,
    debugSuccessTitle,
    skipToast = false,
    skipDebugToast = false,
  } = options

  const { showDebugLoading, showDebugSuccess, showError, hideToast } = useToast()

  const mountedRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)
  const mutationVersionRef = useRef(0)
  const isInFlightRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Abort any in-flight request on unmount
      abortControllerRef.current?.abort()
    }
  }, [])

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    isInFlightRef.current = false
  }, [])

  const execute = useCallback(async () => {
    // Increment version and abort any previous in-flight request
    const version = ++mutationVersionRef.current
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    isInFlightRef.current = true

    // Capture snapshot BEFORE optimistic update (fresh, not stale closure)
    const snapshot = getSnapshot()

    // Apply optimistic update immediately
    applyOptimistic()

    // Show debug loading toast (dev/staging only)
    let loadingToastId: string | undefined
    if (!skipToast && !skipDebugToast && debugLoadingTitle) {
      loadingToastId = showDebugLoading(debugLoadingTitle) || undefined
    }

    try {
      const result = await apiCall(abortController.signal)

      // Check if this response is still relevant (not superseded by a newer call)
      if (version !== mutationVersionRef.current) return

      if (!mountedRef.current) return

      // Dismiss loading toast
      if (loadingToastId) hideToast(loadingToastId)

      // Show debug success toast (dev/staging only)
      if (!skipToast && !skipDebugToast && debugSuccessTitle) {
        showDebugSuccess(debugSuccessTitle)
      }

      // Reconcile with server data
      onSuccess?.(result)
    } catch (error: unknown) {
      // Intentionally aborted — not a failure
      if (error instanceof DOMException && error.name === 'AbortError') return

      // Superseded by a newer mutation — ignore
      if (version !== mutationVersionRef.current) return

      if (!mountedRef.current) return

      // Dismiss loading toast
      if (loadingToastId) hideToast(loadingToastId)

      // Rollback to pre-mutation state
      rollback(snapshot)

      // Show error toast (always visible, all environments)
      if (!skipToast) {
        const message = typeof errorMessage === 'function'
          ? errorMessage(error instanceof Error ? error : new Error(String(error)))
          : errorMessage || 'Something went wrong. Please try again.'

        showError(
          errorTitle,
          message,
          retryable ? { label: 'Retry', onClick: () => execute() } : undefined
        )
      }
    } finally {
      if (version === mutationVersionRef.current) {
        isInFlightRef.current = false
      }
    }
  }, [
    getSnapshot,
    applyOptimistic,
    apiCall,
    onSuccess,
    rollback,
    errorTitle,
    errorMessage,
    retryable,
    debugLoadingTitle,
    debugSuccessTitle,
    skipToast,
    skipDebugToast,
    showDebugLoading,
    showDebugSuccess,
    showError,
    hideToast,
  ])

  return {
    execute,
    get isInFlight() {
      return isInFlightRef.current
    },
    cancel,
  }
}

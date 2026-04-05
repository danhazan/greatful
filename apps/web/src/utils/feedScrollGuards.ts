export type ScrollDirection = 'up' | 'down' | 'idle'

interface ScrollMetricsInput {
  containerScrollTop?: number | null
  windowScrollY?: number | null
  documentScrollTop?: number | null
}

interface ObserverLoadInput {
  isIntersecting: boolean
  wasIntersecting: boolean
  hasMore: boolean
  hasCursor: boolean
  isFetching: boolean
  scrollDirection: ScrollDirection
}

export function getTrueScrollTop({
  containerScrollTop,
  windowScrollY,
  documentScrollTop,
}: ScrollMetricsInput): number {
  return Math.max(
    containerScrollTop ?? 0,
    windowScrollY ?? 0,
    documentScrollTop ?? 0,
    0
  )
}

export function getScrollDirection(previousScrollTop: number, currentScrollTop: number): ScrollDirection {
  if (currentScrollTop > previousScrollTop) return 'down'
  if (currentScrollTop < previousScrollTop) return 'up'
  return 'idle'
}

export function shouldTriggerObserverLoad({
  isIntersecting,
  wasIntersecting,
  hasMore,
  hasCursor,
  isFetching,
  scrollDirection,
}: ObserverLoadInput): boolean {
  if (!isIntersecting) return false
  if (wasIntersecting) return false
  if (!hasMore || !hasCursor || isFetching) return false
  return scrollDirection === 'down'
}

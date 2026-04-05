import {
  getScrollDirection,
  getTrueScrollTop,
  shouldTriggerObserverLoad,
} from '@/utils/feedScrollGuards'

describe('feedScrollGuards', () => {
  it('uses the true scroll owner by taking the highest available scroll top', () => {
    expect(getTrueScrollTop({
      containerScrollTop: 0,
      windowScrollY: 24,
      documentScrollTop: 12,
    })).toBe(24)
  })

  it('derives scroll direction correctly', () => {
    expect(getScrollDirection(10, 20)).toBe('down')
    expect(getScrollDirection(20, 10)).toBe('up')
    expect(getScrollDirection(20, 20)).toBe('idle')
  })

  it('only triggers observer load while scrolling down into a new visible state', () => {
    expect(shouldTriggerObserverLoad({
      isIntersecting: true,
      wasIntersecting: false,
      hasMore: true,
      hasCursor: true,
      isFetching: false,
      scrollDirection: 'down',
    })).toBe(true)

    expect(shouldTriggerObserverLoad({
      isIntersecting: true,
      wasIntersecting: false,
      hasMore: true,
      hasCursor: true,
      isFetching: false,
      scrollDirection: 'up',
    })).toBe(false)

    expect(shouldTriggerObserverLoad({
      isIntersecting: true,
      wasIntersecting: true,
      hasMore: true,
      hasCursor: true,
      isFetching: false,
      scrollDirection: 'down',
    })).toBe(false)
  })
})

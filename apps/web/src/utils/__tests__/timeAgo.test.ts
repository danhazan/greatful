import { formatTimeAgo } from '../timeAgo'

describe('formatTimeAgo', () => {
  beforeEach(() => {
    // Mock Date.now() to return a consistent timestamp for testing
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should format seconds ago', () => {
    const date = new Date('2024-01-15T11:59:30Z').toISOString() // 30 seconds ago
    expect(formatTimeAgo(date)).toBe('30s')
  })

  it('should format minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00Z').toISOString() // 5 minutes ago
    expect(formatTimeAgo(date)).toBe('5m')
  })

  it('should format hours ago', () => {
    const date = new Date('2024-01-15T09:00:00Z').toISOString() // 3 hours ago
    expect(formatTimeAgo(date)).toBe('3h')
  })

  it('should format days ago', () => {
    const date = new Date('2024-01-12T12:00:00Z').toISOString() // 3 days ago
    expect(formatTimeAgo(date)).toBe('3d')
  })

  it('should format weeks ago', () => {
    const date = new Date('2024-01-01T12:00:00Z').toISOString() // 2 weeks ago
    expect(formatTimeAgo(date)).toBe('2w')
  })

  it('should format years ago', () => {
    const date = new Date('2022-01-15T12:00:00Z').toISOString() // 2 years ago
    expect(formatTimeAgo(date)).toBe('2y')
  })

  it('should handle edge case of 0 seconds', () => {
    const date = new Date('2024-01-15T12:00:00Z').toISOString() // same time
    expect(formatTimeAgo(date)).toBe('0s')
  })

  it('should handle exactly 1 minute', () => {
    const date = new Date('2024-01-15T11:59:00Z').toISOString() // exactly 1 minute ago
    expect(formatTimeAgo(date)).toBe('1m')
  })

  it('should handle exactly 1 hour', () => {
    const date = new Date('2024-01-15T11:00:00Z').toISOString() // exactly 1 hour ago
    expect(formatTimeAgo(date)).toBe('1h')
  })

  it('should handle exactly 1 day', () => {
    const date = new Date('2024-01-14T12:00:00Z').toISOString() // exactly 1 day ago
    expect(formatTimeAgo(date)).toBe('1d')
  })

  it('should handle exactly 1 week', () => {
    const date = new Date('2024-01-08T12:00:00Z').toISOString() // exactly 1 week ago
    expect(formatTimeAgo(date)).toBe('1w')
  })
})
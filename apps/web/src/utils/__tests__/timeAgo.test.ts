import { formatTimeAgo } from '../timeAgo'

describe('formatTimeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should show Just now for recent timestamps', () => {
    const date = new Date('2024-01-15T11:59:30Z').toISOString()
    expect(formatTimeAgo(date)).toBe('Just now')
  })

  it('should format minutes ago', () => {
    const date = new Date('2024-01-15T11:55:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('5m ago')
  })

  it('should format hours ago', () => {
    const date = new Date('2024-01-15T09:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('3h ago')
  })

  it('should format days ago', () => {
    const date = new Date('2024-01-12T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('3d ago')
  })

  it('should format weeks ago', () => {
    const date = new Date('2024-01-01T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('2w ago')
  })

  it('should format years ago', () => {
    const date = new Date('2022-01-15T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('2y ago')
  })

  it('should handle edge case of 0 seconds', () => {
    const date = new Date('2024-01-15T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('Just now')
  })

  it('should handle exactly 1 minute', () => {
    const date = new Date('2024-01-15T11:59:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('1m ago')
  })

  it('should handle exactly 1 hour', () => {
    const date = new Date('2024-01-15T11:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('1h ago')
  })

  it('should handle exactly 1 day', () => {
    const date = new Date('2024-01-14T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('1d ago')
  })

  it('should handle exactly 1 week', () => {
    const date = new Date('2024-01-08T12:00:00Z').toISOString()
    expect(formatTimeAgo(date)).toBe('1w ago')
  })
})

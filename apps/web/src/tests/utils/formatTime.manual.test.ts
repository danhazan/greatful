/**
 * Manual test for formatTime functionality with live time updates
 */

describe('formatTime with live updates', () => {
  // Simulate the formatTime function with currentTime parameter
  const formatTime = (dateString: string | undefined, currentTime: Date) => {
    if (!dateString) return "Unknown time"
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "Invalid date"
    
    const diffInMinutes = (currentTime.getTime() - date.getTime()) / (1000 * 60)
    
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  it('should calculate different relative times correctly', () => {
    const currentTime = new Date('2025-08-26T18:00:00.000Z')
    
    // Test different timestamps
    const oneHourAgo = '2025-08-26T17:00:00.000Z'
    const thirtyMinutesAgo = '2025-08-26T17:30:00.000Z'
    const oneMinuteAgo = '2025-08-26T17:59:00.000Z'
    const thirtySecondsAgo = '2025-08-26T17:59:30.000Z'
    
    expect(formatTime(oneHourAgo, currentTime)).toBe('1h ago')
    expect(formatTime(thirtyMinutesAgo, currentTime)).toBe('30m ago')
    expect(formatTime(oneMinuteAgo, currentTime)).toBe('1m ago')
    expect(formatTime(thirtySecondsAgo, currentTime)).toBe('Just now')
  })

  it('should update when currentTime changes', () => {
    const initialTime = new Date('2025-08-26T18:00:00.000Z')
    const laterTime = new Date('2025-08-26T18:02:00.000Z') // 2 minutes later
    
    const notificationTime = '2025-08-26T17:59:00.000Z' // 1 minute before initial time
    
    // Initially should be "1m ago"
    expect(formatTime(notificationTime, initialTime)).toBe('1m ago')
    
    // After 2 minutes pass, should be "3m ago"
    expect(formatTime(notificationTime, laterTime)).toBe('3m ago')
  })

  it('should handle edge cases', () => {
    const currentTime = new Date('2025-08-26T18:00:00.000Z')
    
    expect(formatTime(undefined, currentTime)).toBe('Unknown time')
    expect(formatTime('invalid-date', currentTime)).toBe('Invalid date')
    expect(formatTime('2025-08-26T18:00:00.000Z', currentTime)).toBe('Just now') // Same time
  })
})
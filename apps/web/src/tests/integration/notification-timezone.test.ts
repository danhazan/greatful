/**
 * Integration test for notification timezone handling
 * Tests that timestamps from the backend are correctly interpreted by the frontend
 */

import { formatTimeAgo } from '@/utils/timeAgo'

describe('Notification Timezone Integration', () => {
  beforeEach(() => {
    // Mock the current time to a fixed point for consistent testing
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2025-08-26T17:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should correctly handle backend timestamps without timezone info', () => {
    // Simulate backend timestamp format (naive datetime converted to string)
    const backendTimestamp = '2025-08-26 16:55:00.000000'
    
    // Simulate the API transformation that adds 'Z' suffix
    const frontendTimestamp = backendTimestamp.replace(' ', 'T') + 'Z'
    
    // Test that the transformed timestamp is interpreted correctly
    const result = formatTimeAgo(frontendTimestamp)
    
    // Should show 5 minutes ago (17:00 - 16:55 = 5 minutes)
    expect(result).toBe('5m')
  })

  it('should handle timestamps that already have Z suffix', () => {
    // Simulate timestamp that already has timezone info
    const timestampWithZ = '2025-08-26T16:50:00.000Z'
    
    // Should not double-add the Z suffix
    const result = formatTimeAgo(timestampWithZ)
    
    // Should show 10 minutes ago (17:00 - 16:50 = 10 minutes)
    expect(result).toBe('10m')
  })

  it('should correctly calculate time differences for recent notifications', () => {
    const testCases = [
      {
        backendTime: '2025-08-26 16:59:30.000000', // 30 seconds ago
        expected: '30s'
      },
      {
        backendTime: '2025-08-26 16:58:00.000000', // 2 minutes ago
        expected: '2m'
      },
      {
        backendTime: '2025-08-26 15:30:00.000000', // 1.5 hours ago
        expected: '1h'
      },
      {
        backendTime: '2025-08-25 17:00:00.000000', // 1 day ago
        expected: '1d'
      }
    ]

    testCases.forEach(({ backendTime, expected }) => {
      const frontendTime = backendTime.replace(' ', 'T') + 'Z'
      const result = formatTimeAgo(frontendTime)
      expect(result).toBe(expected)
    })
  })

  it('should handle batch notification timestamps correctly', () => {
    // Simulate a batch notification scenario where children have different timestamps
    const batchChildren = [
      '2025-08-26 16:58:00.000000', // 2 minutes ago
      '2025-08-26 16:55:00.000000', // 5 minutes ago
      '2025-08-26 16:50:00.000000', // 10 minutes ago
    ]

    const results = batchChildren.map(timestamp => {
      const frontendTime = timestamp.replace(' ', 'T') + 'Z'
      return formatTimeAgo(frontendTime)
    })

    expect(results).toEqual(['2m', '5m', '10m'])
  })

  it('should not show 3h for recent notifications', () => {
    // This was the bug - recent notifications were showing "3h" due to timezone issues
    const recentTimestamps = [
      '2025-08-26 16:59:00.000000', // 1 minute ago
      '2025-08-26 16:45:00.000000', // 15 minutes ago
      '2025-08-26 16:30:00.000000', // 30 minutes ago
    ]

    recentTimestamps.forEach(timestamp => {
      const frontendTime = timestamp.replace(' ', 'T') + 'Z'
      const result = formatTimeAgo(frontendTime)
      
      // None of these should show "3h"
      expect(result).not.toBe('3h')
      
      // They should show minutes
      expect(result).toMatch(/^\d+[ms]$/)
    })
  })

  it('should handle edge case of exactly 3 hours ago', () => {
    // Test that actual 3-hour-old notifications still show "3h"
    const threeHoursAgo = '2025-08-26 14:00:00.000000'
    const frontendTime = threeHoursAgo.replace(' ', 'T') + 'Z'
    const result = formatTimeAgo(frontendTime)
    
    expect(result).toBe('3h')
  })
})
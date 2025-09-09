/**
 * Shared test utilities and helpers for frontend tests.
 * This file provides common mocking patterns and test data factories.
 */

import { jest } from '@jest/globals'

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create a mock localStorage implementation
 */
export const createMockLocalStorage = () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
})

/**
 * Create a mock fetch implementation
 */
export const createMockFetch = () => {
  const mockFetch = jest.fn()
  global.fetch = mockFetch as any
  return mockFetch
}

/**
 * Setup common window mocks
 */
export const setupWindowMocks = () => {
  // Mock localStorage
  const mockLocalStorage = createMockLocalStorage()
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true
  })

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  return { mockLocalStorage }
}

// ============================================================================
// COMPONENT MOCKS
// ============================================================================

/**
 * Create a mock EmojiPicker component factory
 */
export const createMockEmojiPicker = () => {
  return 'MockEmojiPicker' // Return string for jest.mock usage
}

/**
 * Create a mock ReactionViewer component factory
 */
export const createMockReactionViewer = () => {
  return 'MockReactionViewer' // Return string for jest.mock usage
}

// ============================================================================
// SERVICE MOCKS
// ============================================================================

/**
 * Create mock analytics service
 */
export const createMockAnalyticsService = () => ({
  trackHeartEvent: jest.fn(),
  trackReactionEvent: jest.fn(),
  trackShareEvent: jest.fn(),
  trackViewEvent: jest.fn(),
})

/**
 * Setup common service mocks
 */
export const setupServiceMocks = () => {
  // Mock analytics service
  jest.mock('@/services/analytics', () => createMockAnalyticsService())

  // Mock emoji mapping utility
  jest.mock('@/utils/emojiMapping', () => ({
    getEmojiFromCode: jest.fn((code: string) => {
      const mapping: {[key: string]: string} = {
        'heart_eyes': '😍',
        'joy': '😂',
        'thinking': '🤔',
        'fire': '🔥',
        'pray': '🙏'
      }
      return mapping[code] || '😊'
    }),
    getAvailableEmojis: jest.fn(() => [
      { code: 'heart_eyes', emoji: '😍', label: 'Love it' },
      { code: 'fire', emoji: '🔥', label: 'Fire' },
      { code: 'pray', emoji: '🙏', label: 'Grateful' },
      { code: 'muscle', emoji: '💪', label: 'Strong' },
      { code: 'clap', emoji: '👏', label: 'Applause' },
      { code: 'joy', emoji: '😂', label: 'Funny' },
      { code: 'thinking', emoji: '🤔', label: 'Thinking' },
      { code: 'star', emoji: '⭐', label: 'Amazing' }
    ]),
  }))
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory for creating test post data
 */
export const createTestPost = (overrides: any = {}) => ({
  id: 'test-post-1',
  content: 'Test gratitude post',
  author: {
    id: 'author-1',
    name: 'Test Author',
    image: 'https://example.com/author.jpg'
  },
  createdAt: '2024-01-15T10:00:00Z',
  postType: 'daily' as const,
  heartsCount: 5,
  isHearted: false,
  reactionsCount: 3,
  currentUserReaction: undefined,
  ...overrides
})

/**
 * Factory for creating test user data
 */
export const createTestUser = (overrides: any = {}) => ({
  id: 'user-1',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  image: 'https://example.com/user.jpg',
  ...overrides
})

/**
 * Factory for creating test notification data
 */
export const createTestNotification = (overrides: any = {}) => ({
  id: '1',
  type: 'reaction',
  message: 'reacted to your post',
  postId: 'post-1',
  fromUser: {
    id: '2',
    name: 'John Doe',
    image: 'https://example.com/john.jpg'
  },
  createdAt: '2024-01-15T10:00:00Z',
  isRead: false,
  ...overrides
})

// ============================================================================
// API RESPONSE MOCKS
// ============================================================================

/**
 * Create successful API response mock
 */
export const createSuccessResponse = (data: any) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
  headers: new Headers(),
})

/**
 * Create error API response mock
 */
export const createErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  json: () => Promise.resolve({ error: message }),
  headers: new Headers(),
})

/**
 * Setup common API response mocks
 */
export const setupApiMocks = (mockFetch: jest.Mock) => {
  // Default successful responses
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/posts')) {
      return Promise.resolve(createSuccessResponse([createTestPost()]))
    }
    if (url.includes('/api/notifications')) {
      return Promise.resolve(createSuccessResponse([createTestNotification()]))
    }
    if (url.includes('/reactions')) {
      return Promise.resolve(createSuccessResponse({ success: true }))
    }
    if (url.includes('/heart')) {
      return Promise.resolve(createSuccessResponse({ success: true }))
    }
    
    return Promise.resolve(createSuccessResponse({}))
  })
}

// ============================================================================
// TEST ENVIRONMENT SETUP
// ============================================================================

/**
 * Setup complete test environment with all common mocks
 */
export const setupTestEnvironment = () => {
  const { mockLocalStorage } = setupWindowMocks()
  const mockFetch = createMockFetch()
  
  // Setup default API responses
  setupApiMocks(mockFetch)
  
  // Mock localStorage token
  mockLocalStorage.getItem.mockReturnValue('mock-token')
  
  return {
    mockLocalStorage,
    mockFetch,
  }
}

/**
 * Cleanup test environment
 */
export const cleanupTestEnvironment = () => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
}

// ============================================================================
// ASYNC TEST HELPERS
// ============================================================================

/**
 * Suppress React act() warnings for user interaction tests
 */
export const suppressActWarnings = () => {
  const originalError = console.error
  jest.spyOn(console, 'error').mockImplementation((message) => {
    if (typeof message === 'string' && message.includes('act(...)')) {
      return // Suppress act warnings
    }
    originalError(message)
  })
}

/**
 * Wait for async operations to complete
 */
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))

/**
 * Simulate typing in a contentEditable element
 */
export const typeInContentEditable = (element: HTMLElement, text: string) => {
  // Set the text content
  element.textContent = text
  
  // Create and dispatch input event
  const inputEvent = new Event('input', { bubbles: true })
  element.dispatchEvent(inputEvent)
  
  return element
}

/**
 * Get contentEditable element by placeholder text
 */
export const getContentEditableByPlaceholder = (container: HTMLElement, placeholder: string) => {
  return container.querySelector(`[data-placeholder="${placeholder}"]`) as HTMLElement
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Mock factories
  createMockLocalStorage,
  createMockFetch,
  setupWindowMocks,
  createMockEmojiPicker,
  createMockReactionViewer,
  createMockAnalyticsService,
  setupServiceMocks,
  
  // Test data factories
  createTestPost,
  createTestUser,
  createTestNotification,
  
  // API mocks
  createSuccessResponse,
  createErrorResponse,
  setupApiMocks,
  
  // Environment setup
  setupTestEnvironment,
  cleanupTestEnvironment,
  
  // Async helpers
  suppressActWarnings,
  waitForAsync,
  
  // ContentEditable helpers
  typeInContentEditable,
  getContentEditableByPlaceholder,
}
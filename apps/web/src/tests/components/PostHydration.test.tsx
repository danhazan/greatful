import { jest } from '@jest/globals'

// Mock the API client
const mockApiClient = {
  get: jest.fn(),
}

jest.mock('@/utils/apiClient', () => ({
  __esModule: true,
  apiClient: mockApiClient
}))

// Mock the UserContext
const mockUser = {
  id: 'user-123',
  name: 'Test User',
  username: 'tester',
  email: 'test@example.com'
}

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({
    currentUser: mockUser,
    isLoading: false,
    loading: false, // Match SinglePostView usage
    logout: jest.fn()
  })
}))

// Mock PostCard to keep test focused on SinglePostView logic
jest.mock('@/components/PostCard', () => ({
  __esModule: true,
  default: function MockPostCard({ post }: any) {
    return (
      <div data-testid="post-card">
        <span data-testid="post-content">{post.content}</span>
        <span data-testid="user-reaction">{post.currentUserReaction || 'none'}</span>
      </div>
    )
  }
}))

import React from 'react'
import { render, screen, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { createTestPost, setupTestEnvironment, cleanupTestEnvironment } from '../utils/test-helpers'

describe('SinglePostView Hydration', () => {
  let SinglePostView: any

  beforeEach(() => {
    setupTestEnvironment()
    jest.clearAllMocks()
    // Dynamically require to ensure mocks are applied
    SinglePostView = require('@/components/SinglePostView').default
  })

  afterEach(() => {
    cleanupTestEnvironment()
  })

  it('should transition from anonymous SSR bootstrap to authenticated CSR state', async () => {
    const postId = 'post-456'
    
    // SSR Payload: Anonymous (no reaction)
    const ssrPost = createTestPost({
      id: postId,
      content: 'SSR Content',
      currentUserReaction: undefined,
    })

    // CSR Payload: Authenticated (has reaction)
    const csrPost = createTestPost({
      id: postId,
      content: 'CSR Content',
      currentUserReaction: 'heart',
    })

    // Setup mock to return authenticated data
    mockApiClient.get.mockResolvedValue(csrPost)

    render(<SinglePostView postId={postId} bootstrapPost={ssrPost} />)

    // 1. Initial State: Should show SSR bootstrap (anonymous)
    expect(screen.getByTestId('post-content')).toHaveTextContent('SSR Content')
    expect(screen.getByTestId('user-reaction')).toHaveTextContent('none')

    // 2. Wait for hydration fetch to complete
    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith(`/posts/${postId}`, { skipCache: true })
    })

    // 3. Final State: Should show CSR authenticated data
    await waitFor(() => {
      expect(screen.getByTestId('user-reaction')).toHaveTextContent('heart')
    })
    
    // Content should also be from CSR if it differed
    expect(screen.getByTestId('post-content')).toHaveTextContent('CSR Content')
  })

  it('should treat SSR payload as visual placeholder only and perform full replacement', async () => {
    const postId = 'post-789'
    
    // SSR Payload with some stale/guest-scoped values
    const ssrPost = createTestPost({
      id: postId,
      privacyLevel: 'public', // Guest might see it as public
      currentUserReaction: undefined,
    })

    // CSR Payload with authoritative values
    const csrPost = createTestPost({
      id: postId,
      privacyLevel: 'custom', // Auth user knows it's custom
      currentUserReaction: 'pray',
    })

    mockApiClient.get.mockResolvedValue(csrPost)

    render(<SinglePostView postId={postId} bootstrapPost={ssrPost} />)

    // Wait for replacement
    await waitFor(() => {
      expect(screen.getByTestId('user-reaction')).toHaveTextContent('pray')
    })
  })
})

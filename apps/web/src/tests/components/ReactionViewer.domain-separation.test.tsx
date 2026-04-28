import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReactionViewer from '@/components/ReactionViewer'

// Mock cache helpers
jest.mock('@/hooks/useImageReactions', () => ({
  getDetailedReactionsFromCache: jest.fn(),
  updateDetailedReactionsCache: jest.fn()
}))

describe('ReactionViewer Domain Separation', () => {
  const mockOnClose = jest.fn()

  it('should include object_type in the API request', async () => {
    // Mock fetch
    const mockFetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    )
    global.fetch = mockFetch

    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="post-1"
        objectType="image"
        objectId="image-123"
      />
    )

    // Check that fetch was called with the correct scoped URL
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('object_type=image'),
      expect.any(Object)
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('object_id=image-123'),
      expect.any(Object)
    )
  })

  it('should default to post object_type if not specified', async () => {
    const mockFetch = jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      })
    )
    global.fetch = mockFetch

    render(
      <ReactionViewer
        isOpen={true}
        onClose={mockOnClose}
        postId="post-1"
      />
    )

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('object_type=post'),
      expect.any(Object)
    )
  })
})

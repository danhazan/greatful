import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ScrollLockManager } from '@/utils/scrollLock'
import MultiImageModal from '@/components/MultiImageModal'
import ReactionViewer from '@/components/ReactionViewer'
import { useState } from 'react'

// Mock dependencies
jest.mock('@/hooks/useImageReactions', () => ({
  useImageReactions: () => ({
    data: {},
    isLoading: false,
    getReactionForImage: () => ({ totalCount: 0, emojiCounts: {}, userReaction: null })
  }),
  getDetailedReactionsFromCache: jest.fn(),
  updateDetailedReactionsCache: jest.fn()
}))

jest.mock('@/hooks/useReactionMutation', () => ({
  useReactionMutation: () => ({
    handleReaction: jest.fn(),
    isInFlight: false
  })
}))

const TestDashboard = () => {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsGalleryOpen(true)}>Open Gallery</button>
      {isGalleryOpen && (
        <MultiImageModal
          isOpen={true}
          onClose={() => setIsGalleryOpen(false)}
          postId="post-1"
          images={[
            { id: '1', position: 0, thumbnailUrl: '', mediumUrl: '', originalUrl: '' }
          ]}
          initialIndex={0}
        />
      )}
      <button onClick={() => setIsViewerOpen(true)}>Open Viewer</button>
      {isViewerOpen && (
        <ReactionViewer
          isOpen={true}
          onClose={() => setIsViewerOpen(false)}
          postId="post-1"
          objectType="post"
          reactions={[]}
        />
      )}
    </div>
  )
}

describe('ScrollLock Stack Integration', () => {
  beforeEach(() => {
    // Reset ScrollLockManager count by calling unlock until 0
    while (ScrollLockManager.getCount() > 0) {
      ScrollLockManager.unlock()
    }
    document.body.style.overflow = ''
  })

  it('should maintain scroll lock when inner modal is closed but outer is still open', async () => {
    render(<TestDashboard />)

    // 1. Open Gallery
    fireEvent.click(screen.getByText('Open Gallery'))
    expect(ScrollLockManager.getCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')

    // 2. Open ReactionViewer (simulated as separate for stack test)
    fireEvent.click(screen.getByText('Open Viewer'))
    expect(ScrollLockManager.getCount()).toBe(2)
    expect(document.body.style.overflow).toBe('hidden')

    // 3. Close ReactionViewer
    fireEvent.click(screen.getAllByLabelText('Close reactions modal')[0])
    expect(ScrollLockManager.getCount()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden') // MUST STILL BE HIDDEN

    // 4. Close Gallery
    fireEvent.click(screen.getByLabelText(/Close image modal/i))
    expect(ScrollLockManager.getCount()).toBe(0)
    expect(document.body.style.overflow).toBe('')
  })
})

import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'
import EmojiPicker from '@/components/EmojiPicker'

const mockAddRecentReaction = jest.fn()

jest.mock('@/hooks/useRecentReactions', () => ({
  useRecentReactions: () => ({
    recentReactions: {
      heart: ['heart', 'sparkling_heart'],
      face: ['blush'],
      hands: [],
      misc: []
    },
    addRecentReaction: mockAddRecentReaction,
    isLoading: false
  })
}))

Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 })

function createTriggerRef() {
  const el = document.createElement('button')
  document.body.appendChild(el)
  el.getBoundingClientRect = () => ({
    x: 100, y: 200, width: 50, height: 50,
    top: 200, right: 150, bottom: 250, left: 100,
    toJSON: () => ({}),
  })
  return { current: el } as React.RefObject<HTMLElement>
}

describe('EmojiPicker', () => {
  const mockOnClose = jest.fn()
  const mockOnCancel = jest.fn()
  const mockOnEmojiSelect = jest.fn()
  const defaultTriggerRef = createTriggerRef()

  let mockVibrate: jest.Mock
  let currentTime = 1000

  beforeEach(() => {
    jest.clearAllMocks()
    currentTime += 100
    jest.spyOn(Date, 'now').mockReturnValue(currentTime)
    mockVibrate = jest.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: mockVibrate,
      writable: true,
      configurable: true
    })
  })

  it('renders when open and shows four compact group rows', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Four + buttons for each group
    expect(screen.getByLabelText('Show all Heart emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Face emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Hands emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Misc emojis')).toBeInTheDocument()
    // No expanded grid in overview mode
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <EmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onEmojiSelect and onClose when emoji is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const heartButton = screen.getAllByLabelText(/React with Heart/)[0]
    fireEvent.click(heartButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('expands to show full grid when clicking + button', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    expect(screen.queryByRole('grid')).not.toBeInTheDocument()

    const expandButton = screen.getByLabelText('Show all Heart emojis')
    fireEvent.click(expandButton)

    expect(screen.getByRole('grid')).toBeInTheDocument()
  })

  it('shows correct expanded grid for each group when clicking its + button', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    // Heart
    fireEvent.click(screen.getByLabelText('Show all Heart emojis'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Heart emoji reactions')

    // Face
    fireEvent.click(screen.getByLabelText('Face'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Face emoji reactions')

    // Hands
    fireEvent.click(screen.getByLabelText('Hands'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Hands emoji reactions')

    // Misc
    fireEvent.click(screen.getByLabelText('Misc'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Misc emoji reactions')
  })

  it('header uses icons with accessible aria-labels instead of visible text', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    // No visible text group names
    expect(screen.queryByText('Heart')).not.toBeInTheDocument()
    expect(screen.queryByText('Face')).not.toBeInTheDocument()
    expect(screen.queryByText('Hands')).not.toBeInTheDocument()
    expect(screen.queryByText('Misc')).not.toBeInTheDocument()

    // Icon buttons present with aria-labels
    expect(screen.getByLabelText('Heart')).toBeInTheDocument()
    expect(screen.getByLabelText('Face')).toBeInTheDocument()
    expect(screen.getByLabelText('Hands')).toBeInTheDocument()
    expect(screen.getByLabelText('Misc')).toBeInTheDocument()
  })

  it('active expanded group has distinct visual state', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const heartIconButton = screen.getByLabelText('Heart')
    fireEvent.click(heartIconButton)

    // The Heart icon should be active (has bg-purple-100 class)
    expect(heartIconButton.className).toContain('bg-purple-100')
    // Face icon should not be active
    expect(screen.getByLabelText('Face').className).not.toContain('bg-purple-100')
  })

  it('closing and reopening resets to four-row overview', () => {
    const { rerender } = render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    fireEvent.click(screen.getByLabelText('Show all Heart emojis'))
    expect(screen.getByRole('grid')).toBeInTheDocument()

    // Close
    rerender(
      <EmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    // Reopen
    rerender(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    // Should be back to overview - no grid
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
    // Should have all four + buttons again
    expect(screen.getByLabelText('Show all Heart emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Face emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Hands emojis')).toBeInTheDocument()
    expect(screen.getByLabelText('Show all Misc emojis')).toBeInTheDocument()
  })

  it('highlights current reaction', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        currentReaction="heart"
        triggerRef={defaultTriggerRef}
      />
    )

    const heartButton = screen.getAllByLabelText('React with Heart')[0]
    expect(heartButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('calls onCancel when close button is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const closeButton = screen.getByLabelText('Close emoji picker')
    fireEvent.click(closeButton)

    expect(mockOnCancel).toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('header icons navigate between expanded groups', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    // Start in expanded Heart
    fireEvent.click(screen.getByLabelText('Show all Heart emojis'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Heart emoji reactions')

    // Navigate via header icon
    fireEvent.click(screen.getByLabelText('Face'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Face emoji reactions')

    // Navigate to Hands
    fireEvent.click(screen.getByLabelText('Hands'))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'Hands emoji reactions')
  })
})

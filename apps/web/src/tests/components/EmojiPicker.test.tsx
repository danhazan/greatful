import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'
import EmojiPicker from '@/components/EmojiPicker'

// Mock window dimensions for positioning
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
})

describe('EmojiPicker', () => {
  const mockOnClose = jest.fn()
  const mockOnCancel = jest.fn()
  const mockOnEmojiSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when open', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.getByText('React with')).toBeInTheDocument()
    // Caption text was removed - keyboard shortcuts were redundant
  })

  it('does not render when closed', () => {
    render(
      <EmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.queryByText('React with')).not.toBeInTheDocument()
  })

  it('displays all 56 emoji options in 7 rows', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const emojiButtons = screen.getAllByRole('gridcell')
    expect(emojiButtons).toHaveLength(56)

    // Check for specific emojis from each row (using getAllByText for emojis that appear multiple times)
    // Row 1 - Original
    expect(screen.getByText('💜')).toBeInTheDocument() // Heart
    expect(screen.getByText('😍')).toBeInTheDocument() // Love it
    expect(screen.getAllByText('🤗').length).toBeGreaterThanOrEqual(1) // Hug (also Warm Hug)
    expect(screen.getByText('🥹')).toBeInTheDocument() // Grateful (bug fix - was 🙏)
    expect(screen.getByText('💪')).toBeInTheDocument() // Strong
    expect(screen.getByText('🙏')).toBeInTheDocument() // Thankful
    expect(screen.getByText('🙌')).toBeInTheDocument() // Praise
    expect(screen.getByText('👏')).toBeInTheDocument() // Applause

    // Row 2 - Love/Warmth
    expect(screen.getByText('⭐')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()

    // Row 3 - Joy/Celebration
    expect(screen.getByText('🎉')).toBeInTheDocument()
    expect(screen.getByText('🥳')).toBeInTheDocument()

    // Row 4 - Encouragement
    expect(screen.getByText('💯')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()

    // Row 5 - Nature/Peace
    expect(screen.getByText('🌈')).toBeInTheDocument()
    expect(screen.getByText('🦋')).toBeInTheDocument()

    // Row 6 - Affection
    expect(screen.getByText('🫶')).toBeInTheDocument()

    // Row 7 - Expressions
    expect(screen.getByText('😇')).toBeInTheDocument()
    expect(screen.getByText('🫡')).toBeInTheDocument()
  })

  it('calls onEmojiSelect and onClose when emoji is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const loveItButton = screen.getByLabelText(/React with Love it/)
    fireEvent.click(loveItButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_eyes')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('highlights current reaction', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        currentReaction="touched"
      />
    )

    const touchedButton = screen.getByLabelText(/React with Grateful/)
    expect(touchedButton).toHaveClass('bg-purple-100', 'ring-2', 'ring-purple-500')
  })

  it('calls onCancel when close button is clicked (not onClose)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const closeButton = screen.getByLabelText('Cancel and close emoji picker')
    fireEvent.click(closeButton)

    expect(mockOnCancel).toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('calls onCancel when escape key is pressed (not onClose)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnCancel).toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('does NOT select emoji when number key is pressed (shortcuts removed)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    // Press '1' key - should NOT trigger emoji selection anymore
    fireEvent.keyDown(document, { key: '1' })

    expect(mockOnEmojiSelect).not.toHaveBeenCalled()
  })

  it('calls onCancel when clicking outside (not onClose)', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onCancel={mockOnCancel}
          onEmojiSelect={mockOnEmojiSelect}
        />
      </div>
    )

    const outsideElement = screen.getByTestId('outside')
    fireEvent.mouseDown(outsideElement)

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  it('positions correctly based on provided position', () => {
    const position = { x: 100, y: 200 }

    // Mock window dimensions for consistent positioning calculations
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        position={position}
      />
    )

    // Find the modal by its role
    const modal = screen.getByRole('dialog')

    // Check that the modal has the fixed positioning class
    expect(modal).toHaveClass('fixed')

    // Check that inline styles are applied for positioning
    // The component calculates: left: Math.max(16, Math.min(position.x - 140, window.innerWidth - 356))
    // With x=100, innerWidth=1024: Math.max(16, Math.min(100-140, 1024-356)) = Math.max(16, Math.min(-40, 668)) = Math.max(16, -40) = 16
    expect(modal).toHaveStyle({ left: '16px' })
  })

  it('scrollable container has max-height and scroll containment', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const modal = screen.getByRole('dialog')
    const scrollContainer = modal.querySelector('.overflow-y-auto')

    expect(scrollContainer).toBeInTheDocument()
    expect(scrollContainer).toHaveClass('max-h-[280px]', 'overscroll-contain')
  })

  it('calls onCancel when clicking the same emoji that is already selected', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        currentReaction="heart"
      />
    )

    const heartButton = screen.getByLabelText(/React with Heart.*Currently selected/)
    fireEvent.click(heartButton)

    expect(mockOnCancel).toHaveBeenCalled()
    expect(mockOnEmojiSelect).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})

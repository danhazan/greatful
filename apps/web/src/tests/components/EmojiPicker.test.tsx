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
  const mockOnEmojiSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when open', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.getByText('React with')).toBeInTheDocument()
    expect(screen.getByText(/Use number keys 1-8 or click to react/)).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <EmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.queryByText('React with')).not.toBeInTheDocument()
  })

  it('displays all 8 emoji options', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const emojiButtons = screen.getAllByRole('gridcell')
    expect(emojiButtons).toHaveLength(8)

    // Check for specific emojis based on current implementation
    expect(screen.getByText('😍')).toBeInTheDocument() // Love it
    expect(screen.getByText('🔥')).toBeInTheDocument() // Fire
    expect(screen.getByText('🙏')).toBeInTheDocument() // Grateful
    expect(screen.getByText('💪')).toBeInTheDocument() // Strong
    expect(screen.getByText('👏')).toBeInTheDocument() // Applause
    expect(screen.getByText('😂')).toBeInTheDocument() // Funny
    expect(screen.getByText('🤔')).toBeInTheDocument() // Thinking
    expect(screen.getByText('⭐')).toBeInTheDocument() // Amazing
  })

  it('calls onEmojiSelect when emoji is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const loveItButton = screen.getByLabelText(/React with Love it/)
    fireEvent.click(loveItButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_face')
  })

  it('highlights current reaction', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        currentReaction="pray"
      />
    )

    const prayButton = screen.getByLabelText(/React with Grateful/)
    expect(prayButton).toHaveClass('bg-purple-100', 'ring-2', 'ring-purple-500')
  })

  it('closes when close button is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const closeButton = screen.getByLabelText('Close emoji picker')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes when escape key is pressed', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('selects emoji when number key is pressed', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    // Press '1' key for first emoji (heart_face)
    fireEvent.keyDown(document, { key: '1' })

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_face')
  })

  it('closes when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onEmojiSelect={mockOnEmojiSelect}
        />
      </div>
    )

    const outsideElement = screen.getByTestId('outside')
    fireEvent.mouseDown(outsideElement)

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
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
        onEmojiSelect={mockOnEmojiSelect}
        position={position}
      />
    )

    // Find the modal by its role
    const modal = screen.getByRole('dialog')
    
    // Check that the modal has the fixed positioning class
    expect(modal).toHaveClass('fixed')
    
    // Check that inline styles are applied for positioning
    // The component calculates: left: Math.max(16, Math.min(position.x - 140, window.innerWidth - 296))
    // With x=100, innerWidth=1024: Math.max(16, Math.min(100-140, 1024-296)) = Math.max(16, Math.min(-40, 728)) = Math.max(16, -40) = 16
    expect(modal).toHaveStyle({ left: '16px' })
    
    // Top position: Math.max(16, Math.min(position.y - 8, window.innerHeight - 200))
    // With y=200: position.y - 8 = 192px (assuming sufficient window height)
    expect(modal.style.top).toBeTruthy() // Just verify top style is set
  })

  it('shows keyboard shortcuts in tooltips', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const loveItButton = screen.getByLabelText(/React with Love it/)
    expect(loveItButton).toHaveAttribute('title', 'Love it (1)')
  })
})
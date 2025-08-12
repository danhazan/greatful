import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
    expect(screen.getByText('Use number keys 1-8 or click to react')).toBeInTheDocument()
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

    const emojiButtons = screen.getAllByRole('button', { name: /React with/ })
    expect(emojiButtons).toHaveLength(8)

    // Check for specific emojis
    expect(screen.getByText('😍')).toBeInTheDocument()
    expect(screen.getByText('🤗')).toBeInTheDocument()
    expect(screen.getByText('🙏')).toBeInTheDocument()
    expect(screen.getByText('💪')).toBeInTheDocument()
    expect(screen.getByText('🌟')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('🥰')).toBeInTheDocument()
    expect(screen.getByText('👏')).toBeInTheDocument()
  })

  it('calls onEmojiSelect when emoji is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const heartEyesButton = screen.getByLabelText('React with Heart Eyes')
    fireEvent.click(heartEyesButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_eyes')
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

    const prayButton = screen.getByLabelText('React with Pray')
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

    // Press '1' key for first emoji (heart_eyes)
    fireEvent.keyDown(document, { key: '1' })

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_eyes')
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
    
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={position}
      />
    )

    const modal = screen.getByText('React with').parentElement.parentElement
    expect(modal).toHaveStyle({
      left: '100px',
      top: '192px', // 200 - 8 (marginTop)
    })
  })

  it('shows keyboard shortcuts in tooltips', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const heartEyesButton = screen.getByLabelText('React with Heart Eyes')
    expect(heartEyesButton).toHaveAttribute('title', 'Heart Eyes (1)')
  })
})
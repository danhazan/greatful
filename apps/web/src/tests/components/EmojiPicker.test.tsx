import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { jest } from '@jest/globals'
import EmojiPicker from '@/components/EmojiPicker'
import { createRef } from 'react'

// Mock window dimensions
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

function createTriggerRef() {
  const el = document.createElement('button')
  document.body.appendChild(el)
  // Default bounding rect: 100,200,150,250 (left,top,right,bottom)
  el.getBoundingClientRect = () => ({
    x: 100, y: 200, width: 50, height: 50,
    top: 200, right: 150, bottom: 250, left: 100,
    toJSON: () => ({}),
  })
  const ref = { current: el } as React.RefObject<HTMLElement>
  return ref
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

  it('renders when open', () => {
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

  it('displays all 56 emoji options in 7 rows', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const emojiButtons = screen.getAllByRole('gridcell')
    expect(emojiButtons).toHaveLength(56)

    expect(screen.getByText('💜')).toBeInTheDocument()
    expect(screen.getByText('😍')).toBeInTheDocument()
    expect(screen.getAllByText('🤗').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('🥹')).toBeInTheDocument()
    expect(screen.getByText('💪')).toBeInTheDocument()
    expect(screen.getByText('🙏')).toBeInTheDocument()
    expect(screen.getByText('🙌')).toBeInTheDocument()
    expect(screen.getByText('👏')).toBeInTheDocument()

    expect(screen.getByText('⭐')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
    expect(screen.getByText('✨')).toBeInTheDocument()
    expect(screen.getByText('🎉')).toBeInTheDocument()
    expect(screen.getByText('🥳')).toBeInTheDocument()
    expect(screen.getByText('💯')).toBeInTheDocument()
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('🌈')).toBeInTheDocument()
    expect(screen.getByText('🦋')).toBeInTheDocument()
    expect(screen.getByText('🫶')).toBeInTheDocument()
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
        triggerRef={defaultTriggerRef}
      />
    )

    const loveItButton = screen.getByLabelText(/React with Love it/)
    fireEvent.click(loveItButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart_eyes')
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('triggers vibration ONLY when an emoji is clicked', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    expect(mockVibrate).not.toHaveBeenCalled()

    const heartButton = screen.getByTitle('Heart')
    fireEvent.click(heartButton)

    expect(mockVibrate).toHaveBeenCalledWith(10)
  })

  it('does NOT trigger vibration on touch start or scroll (mobile safe)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const heartButton = screen.getByTitle('Heart')

    fireEvent.touchStart(heartButton, { touches: [{ clientX: 0, clientY: 0 }] })
    expect(mockVibrate).not.toHaveBeenCalled()

    fireEvent.touchMove(heartButton, { touches: [{ clientX: 0, clientY: 50 }] })
    expect(mockVibrate).not.toHaveBeenCalled()
  })

  it('handles rapid tap spam safely', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const heartButton = screen.getByTitle('Heart')

    fireEvent.click(heartButton)
    fireEvent.click(heartButton)
    fireEvent.click(heartButton)

    expect(mockVibrate).toHaveBeenCalled()
  })

  it('prevents event bubbling (Nested Click Safety)', () => {
    const parentClick = jest.fn()

    render(
      <div onClick={parentClick}>
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onCancel={mockOnCancel}
          onEmojiSelect={mockOnEmojiSelect}
          triggerRef={defaultTriggerRef}
        />
      </div>
    )

    const heartButton = screen.getByTitle('Heart')
    fireEvent.click(heartButton)

    expect(parentClick).not.toHaveBeenCalled()
    expect(mockVibrate).toHaveBeenCalledWith(10)
  })

  it('prevents click after scroll edge case (Mobile Tap vs Scroll)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const gridContainer = screen.getByRole('grid')
    const heartButton = screen.getByTitle('Heart')

    fireEvent.touchStart(gridContainer, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(gridContainer, { touches: [{ clientX: 0, clientY: 50 }] })
    fireEvent.click(heartButton)

    expect(mockVibrate).not.toHaveBeenCalled()
    expect(mockOnEmojiSelect).not.toHaveBeenCalled()
  })

  it('integration: successfully selects emoji after scrolling (Scroll then Tap)', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const gridContainer = screen.getByRole('grid')
    const heartButton = screen.getByTitle('Heart')

    fireEvent.touchStart(gridContainer, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchMove(gridContainer, { touches: [{ clientX: 0, clientY: 50 }] })
    fireEvent.touchEnd(gridContainer)
    fireEvent.click(heartButton)
    expect(mockVibrate).not.toHaveBeenCalled()

    fireEvent.touchStart(heartButton, { touches: [{ clientX: 0, clientY: 0 }] })
    fireEvent.touchEnd(heartButton)
    fireEvent.click(heartButton)

    expect(mockVibrate).toHaveBeenCalledTimes(1)
    expect(mockOnEmojiSelect).toHaveBeenCalledWith('heart')
  })

  it('highlights current reaction', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        currentReaction="touched"
        triggerRef={defaultTriggerRef}
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
        triggerRef={defaultTriggerRef}
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
        triggerRef={defaultTriggerRef}
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
        triggerRef={defaultTriggerRef}
      />
    )

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
          triggerRef={defaultTriggerRef}
        />
      </div>
    )

    const outsideElement = screen.getByTestId('outside')
    fireEvent.pointerDown(outsideElement)

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled()
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  it('renders as a fixed-position self-positioning dialog', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('fixed')
    expect(modal.style.left).toBeTruthy()
    expect(modal.style.top).toBeTruthy()
  })

  it('scrollable container has max-height and scroll containment', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onCancel={mockOnCancel}
        onEmojiSelect={mockOnEmojiSelect}
        triggerRef={defaultTriggerRef}
      />
    )

    const modal = screen.getByRole('dialog')
    const scrollContainer = modal.querySelector('.overflow-y-auto')

    expect(scrollContainer).toBeInTheDocument()
    expect(scrollContainer).toHaveClass('overscroll-contain')
    expect((scrollContainer as HTMLElement).style.maxHeight).toBe('280px')
  })

  it('calls onCancel when clicking the same emoji that is already selected', () => {
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

    const heartButton = screen.getByLabelText(/React with Heart.*Currently selected/)
    fireEvent.click(heartButton)

    expect(mockOnCancel).toHaveBeenCalled()
    expect(mockOnEmojiSelect).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })
})

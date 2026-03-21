import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import MinimalEmojiPicker from '@/components/MinimalEmojiPicker'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('MinimalEmojiPicker', () => {
  const mockOnClose = jest.fn()
  const mockOnEmojiSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders when open', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.getByText('Smileys & Happiness')).toBeInTheDocument()
    expect(screen.getByText('Hearts & Love')).toBeInTheDocument()
    expect(screen.getByText('Hand Gestures')).toBeInTheDocument()
    expect(screen.getByText('Nature & Weather')).toBeInTheDocument()
    expect(screen.getByText('Celebration & Success')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <MinimalEmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.queryByText('Smileys')).not.toBeInTheDocument()
  })

  it('calls onEmojiSelect when emoji is clicked', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Find and click the first emoji (😀)
    const emojiButton = screen.getByTitle('grinning face')
    fireEvent.click(emojiButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('😀')
  })

  it('calls onClose when backdrop is clicked', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Click the backdrop
    const backdrop = document.querySelector('.fixed.inset-0.z-50')
    expect(backdrop).toBeInTheDocument()
    fireEvent.click(backdrop!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when escape key is pressed', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('positions picker above emoji button with correct size', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const picker = document.querySelector('[data-minimal-emoji-picker]')
    expect(picker).toBeInTheDocument()
    expect(picker).toHaveStyle('width: min(calc(100vw - 32px), 672px)')
    expect(picker).toHaveStyle('maxHeight: 320px')
  })

  it('supports custom anchor gap for placement', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
        anchorGap={0}
      />
    )

    const picker = document.querySelector('[data-minimal-emoji-picker]')
    expect(picker).toBeInTheDocument()
    expect(picker).toHaveStyle('bottom: 268px')
  })

  it('contains all expected emoji groups', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Check that we have emojis from each group
    expect(screen.getByTitle('grinning face')).toBeInTheDocument() // Smileys
    expect(screen.getByTitle('red heart')).toBeInTheDocument() // Hearts
    expect(screen.getByTitle('thumbs up')).toBeInTheDocument() // Gestures
    expect(screen.getByTitle('cherry blossom')).toBeInTheDocument() // Nature
    expect(screen.getByTitle('party popper')).toBeInTheDocument() // Celebration
  })

  it('shows recently used section when there are recent emojis', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['😀', '❤️', '👍']))

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.getByText('Recently Used')).toBeInTheDocument()
  })

  it('does not show recently used section when there are no recent emojis', () => {
    localStorageMock.getItem.mockReturnValue(null)

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.queryByText('Recently Used')).not.toBeInTheDocument()
  })

  it('saves emoji to recently used when selected', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['❤️']))

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const emojiButton = screen.getByTitle('grinning face')
    fireEvent.click(emojiButton)

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'grateful_recent_emojis',
      JSON.stringify(['😀', '❤️'])
    )
    expect(mockOnEmojiSelect).toHaveBeenCalledWith('😀')
  })

  it('shows compact category labels without adding much chrome', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const sectionTitle = screen.getByText('Smileys & Happiness')
    expect(sectionTitle).toHaveClass('text-[10px]')
    expect(sectionTitle).toHaveClass('text-gray-400')
  })

  it('shows search bar after toggling search mode', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.queryByPlaceholderText('Search emojis')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')
    expect(searchInput).toBeInTheDocument()
    expect(searchInput).toHaveAttribute('type', 'text')
  })

  it('filters emojis when searching', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Type "heart" to search for heart emojis
    fireEvent.change(searchInput, { target: { value: 'heart' } })

    // Should hide category sections when searching
    expect(screen.queryByText('Smileys & Happiness')).not.toBeInTheDocument()
    expect(screen.queryByText('Hearts & Love')).not.toBeInTheDocument()
    expect(screen.getByTitle('red heart')).toBeInTheDocument()
  })

  it('shows no results message when search has no matches', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Type something that won't match any emojis
    fireEvent.change(searchInput, { target: { value: 'xyz123' } })

    // Should show no results message
    expect(screen.getByText('No emojis found for "xyz123"')).toBeInTheDocument()
  })

  it('clears search when escape is pressed while searching', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Type to search
    fireEvent.change(searchInput, { target: { value: 'heart' } })
    expect(searchInput).toHaveValue('heart')

    // Press escape - should clear search first
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(searchInput).toHaveValue('')

    // Categories should be visible again while search stays open
    expect(screen.getByText('Smileys & Happiness')).toBeInTheDocument()

    // Press escape again - should hide search mode
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('Search emojis')).not.toBeInTheDocument()

    // Press escape a third time - should close modal
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('keeps category sections available for browsing by default', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const sectionHeader = screen.getByText('Smileys & Happiness')

    expect(sectionHeader).toHaveClass('text-[10px]')
    expect(screen.getByTitle('grinning face')).toBeInTheDocument()
  })

  it('shows more emojis in each section', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Should show more than the original 16 emojis per section
    const emojiButtons = screen.getAllByRole('button').filter(button => {
      const title = button.getAttribute('title')
      // Filter for emoji buttons (exclude section headers and category buttons)
      return title && !title.includes('&') && title !== 'More categories' &&
        button.textContent && /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(button.textContent)
    })

    // Should have many more emojis now (exact count will vary)
    expect(emojiButtons.length).toBeGreaterThan(50)
  })

  it('prevents focus changes when clicking emoji buttons', () => {
    const mockPreventDefault = jest.fn()

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const emojiButton = screen.getByTitle('grinning face')

    // Mock the mousedown event
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true })
    Object.defineProperty(mouseDownEvent, 'preventDefault', {
      value: mockPreventDefault
    })

    emojiButton.dispatchEvent(mouseDownEvent)

    // Should have called preventDefault to prevent focus change
    expect(mockPreventDefault).toHaveBeenCalled()
  })

  it('shows the bottom category toolbar when not searching', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    expect(screen.getByLabelText('Show emoji search')).toBeInTheDocument()
    expect(screen.getByLabelText('Smileys & Happiness')).toBeInTheDocument()
  })

  it('keeps category toolbar visible while searching', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Type to search
    fireEvent.change(searchInput, { target: { value: 'heart' } })

    expect(screen.getByLabelText('Smileys & Happiness')).toBeInTheDocument()
    expect(screen.getByLabelText('Hearts & Love')).toBeInTheDocument()
  })

  it('uses responsive height calculation', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    })

    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    })

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const picker = document.querySelector('[data-minimal-emoji-picker]')
    expect(picker).toBeInTheDocument()

    const expectedHeight = Math.min(340, 800 * 0.42)
    expect(picker).toHaveStyle(`maxHeight: ${expectedHeight}px`)
  })

  it('can search for pizza and find it', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Type "pizza" to search
    fireEvent.change(searchInput, { target: { value: 'pizza' } })

    // Pizza emoji should be in the results (🍕)
    expect(screen.getByText('🍕')).toBeInTheDocument()
  })

  it('shows proper emoji names in tooltips', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Should show proper emoji names instead of "Insert 😀"
    const emojiButton = screen.getByTitle('grinning face')
    expect(emojiButton).toBeInTheDocument()
    expect(emojiButton.textContent).toBe('😀')
  })

  it('can search using emoji names and keywords', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    fireEvent.click(screen.getByLabelText('Show emoji search'))

    const searchInput = screen.getByPlaceholderText('Search emojis')

    // Search by emoji name
    fireEvent.change(searchInput, { target: { value: 'grinning face' } })
    expect(screen.getByText('😀')).toBeInTheDocument()

    // Clear and search by keyword
    fireEvent.change(searchInput, { target: { value: 'happy' } })
    expect(screen.getByText('😀')).toBeInTheDocument()

    // Clear and search for heart
    fireEvent.change(searchInput, { target: { value: 'heart' } })
    expect(screen.getByText('❤️')).toBeInTheDocument()
  })


})

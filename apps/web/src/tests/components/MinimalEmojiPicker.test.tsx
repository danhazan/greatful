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

    const picker = document.querySelector('.fixed.z-50.bg-white')
    expect(picker).toBeInTheDocument()
    expect(picker).toHaveStyle('width: min(calc(100vw - 32px), 672px)')
    // Should use compressed desktop height by default in test environment
    expect(picker).toHaveStyle('maxHeight: 280px')
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

  it('prevents text selection on section titles', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const sectionTitle = screen.getByText('Smileys & Happiness')
    expect(sectionTitle).toHaveClass('select-none')
  })

  it('shows search bar when open', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search emojis...')
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

    const searchInput = screen.getByPlaceholderText('Search emojis...')

    // Type "heart" to search for heart emojis
    fireEvent.change(searchInput, { target: { value: 'heart' } })

    // Should show search results section
    expect(screen.getByText(/Search Results/)).toBeInTheDocument()

    // Should hide category sections when searching
    expect(screen.queryByText('Smileys & Happiness')).not.toBeInTheDocument()
    expect(screen.queryByText('Hearts & Love')).not.toBeInTheDocument()
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

    const searchInput = screen.getByPlaceholderText('Search emojis...')

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

    const searchInput = screen.getByPlaceholderText('Search emojis...')

    // Type to search
    fireEvent.change(searchInput, { target: { value: 'heart' } })
    expect(searchInput).toHaveValue('heart')

    // Press escape - should clear search first
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(searchInput).toHaveValue('')

    // Should show categories again
    expect(screen.getByText('Smileys & Happiness')).toBeInTheDocument()

    // Press escape again - should close modal
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('allows collapsing and expanding sections', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const sectionHeader = screen.getByText('Smileys & Happiness')

    // Initially expanded - should show emojis
    expect(screen.getByTitle('grinning face')).toBeInTheDocument()

    // Click to collapse
    fireEvent.click(sectionHeader)

    // Should hide emojis when collapsed
    expect(screen.queryByTitle('Insert 😀')).not.toBeInTheDocument()

    // Click to expand again
    fireEvent.click(sectionHeader)

    // Should show emojis when expanded
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

  it('shows category toolbar when not searching', async () => {
    // Mock a wider container for the test
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 600, // Wide enough to show several category icons
    })

    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    // Wait for the responsive calculation to complete
    await new Promise(resolve => setTimeout(resolve, 50))

    // Should show category icons or overflow menu
    const categoryToolbar = document.querySelector('[class*="border-b border-gray-100 px-2 py-1"]')
    expect(categoryToolbar).toBeInTheDocument()
  })

  it('hides category toolbar when searching', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 500 }}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search emojis...')

    // Type to search
    fireEvent.change(searchInput, { target: { value: 'heart' } })

    // Category toolbar should be hidden when searching
    expect(screen.queryByTitle('Smileys & Happiness')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Hearts & Love')).not.toBeInTheDocument()
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

    const picker = document.querySelector('.fixed.z-50.bg-white')
    expect(picker).toBeInTheDocument()

    // Should use mobile height (35% of viewport height, max 240px)
    const expectedHeight = Math.min(240, 800 * 0.35) // 240px
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

    const searchInput = screen.getByPlaceholderText('Search emojis...')

    // Type "pizza" to search
    fireEvent.change(searchInput, { target: { value: 'pizza' } })

    // Should show search results section
    expect(screen.getByText(/Search Results/)).toBeInTheDocument()

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

    const searchInput = screen.getByPlaceholderText('Search emojis...')

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
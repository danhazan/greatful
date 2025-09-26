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
        position={{ x: 100, y: 200 }}
      />
    )

    expect(screen.getByText('Smileys')).toBeInTheDocument()
    expect(screen.getByText('Hearts')).toBeInTheDocument()
    expect(screen.getByText('Gestures')).toBeInTheDocument()
    expect(screen.getByText('Nature')).toBeInTheDocument()
    expect(screen.getByText('Celebration')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <MinimalEmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 200 }}
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
        position={{ x: 100, y: 200 }}
      />
    )

    // Find and click the first emoji (😀)
    const emojiButton = screen.getByTitle('Insert 😀')
    fireEvent.click(emojiButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('😀')
  })

  it('calls onClose when backdrop is clicked', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 200 }}
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
        position={{ x: 100, y: 200 }}
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
        position={{ x: 100, y: 200 }}
      />
    )

    const picker = document.querySelector('.fixed.z-50.bg-white')
    expect(picker).toBeInTheDocument()
    expect(picker).toHaveStyle('width: min(calc(100vw - 32px), 672px)')
    expect(picker).toHaveStyle('maxHeight: 141px')
  })

  it('contains all expected emoji groups', () => {
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 200 }}
      />
    )

    // Check that we have emojis from each group
    expect(screen.getByTitle('Insert 😀')).toBeInTheDocument() // Smileys
    expect(screen.getByTitle('Insert ❤️')).toBeInTheDocument() // Hearts
    expect(screen.getByTitle('Insert 👍')).toBeInTheDocument() // Gestures
    expect(screen.getByTitle('Insert 🌸')).toBeInTheDocument() // Nature
    expect(screen.getByTitle('Insert 🎉')).toBeInTheDocument() // Celebration
  })

  it('shows recently used section when there are recent emojis', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['😀', '❤️', '👍']))
    
    render(
      <MinimalEmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
        position={{ x: 100, y: 200 }}
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
        position={{ x: 100, y: 200 }}
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
        position={{ x: 100, y: 200 }}
      />
    )

    const emojiButton = screen.getByTitle('Insert 😀')
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
        position={{ x: 100, y: 200 }}
      />
    )

    const sectionTitle = screen.getByText('Smileys')
    expect(sectionTitle).toHaveClass('select-none')
  })
})
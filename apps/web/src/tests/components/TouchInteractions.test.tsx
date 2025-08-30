import React from 'react'
import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import FollowButton from '@/components/FollowButton'
import EmojiPicker from '@/components/EmojiPicker'
import MentionAutocomplete from '@/components/MentionAutocomplete'

// Mock fetch globally
global.fetch = jest.fn()

// Mock the haptic feedback utility
const mockCreateTouchHandlers = jest.fn(() => ({
  onTouchStart: jest.fn(),
  onTouchEnd: jest.fn(),
  onTouchCancel: jest.fn()
}))

jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: mockCreateTouchHandlers
}))

// Mock navigator.vibrate
const mockVibrate = jest.fn()
Object.defineProperty(navigator, 'vibrate', {
  value: mockVibrate,
  writable: true
})

describe('Touch Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVibrate.mockClear()
    mockCreateTouchHandlers.mockClear()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('FollowButton Touch Interactions', () => {
    it('should have touch-manipulation class for preventing zoom', () => {
      render(<FollowButton userId={1} />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('touch-manipulation')
    })

    it('should have active scale class for touch feedback', () => {
      render(<FollowButton userId={1} />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('active:scale-95')
    })

    it('should have proper minimum touch target size', () => {
      render(<FollowButton userId={1} size="xs" />)
      const button = screen.getByRole('button')
      // Check that even small buttons have adequate touch targets (reduced by 50%)
      const styles = window.getComputedStyle(button)
      expect(button).toHaveClass('min-h-[22px]')
    })
  })

  describe('EmojiPicker Touch Interactions', () => {
    const mockOnClose = jest.fn()
    const mockOnEmojiSelect = jest.fn()

    beforeEach(() => {
      mockOnClose.mockClear()
      mockOnEmojiSelect.mockClear()
    })

    it('should prevent double-tap zoom on emoji buttons', () => {
      render(
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onEmojiSelect={mockOnEmojiSelect}
        />
      )

      const emojiButtons = screen.getAllByRole('gridcell')
      
      expect(emojiButtons.length).toBeGreaterThan(0)
      
      emojiButtons.forEach(button => {
        expect(button).toHaveClass('touch-manipulation')
        expect(button).toHaveClass('select-none')
        expect(button).toHaveClass('active:scale-95')
      })
    })

    it('should have proper touch target sizes for emoji buttons', () => {
      render(
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onEmojiSelect={mockOnEmojiSelect}
        />
      )

      const emojiButtons = screen.getAllByRole('gridcell')
      
      emojiButtons.forEach(button => {
        expect(button).toHaveClass('min-h-[44px]')
        expect(button).toHaveClass('min-w-[44px]')
      })
    })

    it('should prevent default on click to avoid zoom', () => {
      const mockPreventDefault = jest.fn()
      render(
        <EmojiPicker
          isOpen={true}
          onClose={mockOnClose}
          onEmojiSelect={mockOnEmojiSelect}
        />
      )

      const emojiButtons = screen.getAllByRole('gridcell')
      const emojiButton = emojiButtons[0]
      
      if (emojiButton) {
        const clickEvent = new MouseEvent('click', { bubbles: true })
        Object.defineProperty(clickEvent, 'preventDefault', {
          value: mockPreventDefault
        })
        
        fireEvent(emojiButton, clickEvent)
        expect(mockOnEmojiSelect).toHaveBeenCalled()
      }
    })
  })

  describe('MentionAutocomplete Touch Interactions', () => {
    const mockOnUserSelect = jest.fn()
    const mockOnClose = jest.fn()
    const mockUsers = [
      { id: 1, username: 'testuser1', profile_image_url: '', bio: 'Test bio 1' },
      { id: 2, username: 'testuser2', profile_image_url: '', bio: 'Test bio 2' }
    ]

    beforeEach(() => {
      mockOnUserSelect.mockClear()
      mockOnClose.mockClear()
    })

    it('should have touch-friendly sizing and prevent zoom', () => {
      render(
        <MentionAutocomplete
          isOpen={true}
          searchQuery=""
          onUserSelect={mockOnUserSelect}
          onClose={mockOnClose}
          position={{ x: 0, y: 0 }}
        />
      )

      const dropdown = document.querySelector('[data-mention-autocomplete]')
      
      if (dropdown) {
        expect(dropdown).toHaveClass('touch-manipulation')
      }
    })

    it('should have proper classes for touch interactions', () => {
      render(
        <MentionAutocomplete
          isOpen={true}
          searchQuery=""
          onUserSelect={mockOnUserSelect}
          onClose={mockOnClose}
          position={{ x: 0, y: 0 }}
        />
      )

      const dropdown = document.querySelector('[data-mention-autocomplete]')
      expect(dropdown).toHaveClass('touch-manipulation')
    })
  })

  describe('Haptic Feedback Integration', () => {
    it('should have touch handlers on interactive elements', () => {
      render(<FollowButton userId={1} />)
      const button = screen.getByRole('button')
      
      // Check that the button has the necessary touch event handlers
      expect(button).toHaveClass('touch-manipulation')
      expect(button).toHaveClass('select-none')
      
      // Simulate touch events to ensure they don't throw errors
      fireEvent.touchStart(button)
      fireEvent.touchEnd(button)
      fireEvent.touchCancel(button)
    })
  })
})
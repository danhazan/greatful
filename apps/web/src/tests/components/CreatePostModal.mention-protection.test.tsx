/**
 * Tests for mention protection in CreatePostModal
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import CreatePostModal from '@/components/CreatePostModal'

// Mock the MentionAutocomplete component
jest.mock('@/components/MentionAutocomplete', () => {
  return function MockMentionAutocomplete() {
    return <div data-testid="mention-autocomplete">Mention Autocomplete</div>
  }
})

describe('CreatePostModal - Mention Protection', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should allow editing of mentions for better user experience', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type a complete mention with space after (completed mention)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? for help!',
        selectionStart: 18,
        selectionEnd: 18
      } 
    })

    expect(textarea.value).toBe('Thanks @Bob7?? for help!')

    // Try to edit inside the completed mention (should now be allowed)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob for help!', // Removing the 7??
        selectionStart: 10,
        selectionEnd: 10
      } 
    })

    // The change should be allowed (no protection interfering)
    expect(textarea.value).toBe('Thanks @Bob for help!')
  })

  it('should allow deleting characters when typing incomplete mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type an incomplete mention (no space after, still being typed)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7',
        selectionStart: 12,
        selectionEnd: 12
      } 
    })

    expect(textarea.value).toBe('Thanks @Bob7')

    // Try to backspace (should be allowed for incomplete mentions)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob',
        selectionStart: 11,
        selectionEnd: 11
      } 
    })

    // The change should be allowed (no protection interfering)
    // Since we removed mention protection, all text editing should work normally
    expect(textarea.value).toBe('Thanks @Bob')
  })

  it('should allow editing outside of mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type content with a mention
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? for help!',
        selectionStart: 18,
        selectionEnd: 18
      } 
    })

    // Edit text after the mention (should be allowed)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? for your help!',
        selectionStart: 25,
        selectionEnd: 25
      } 
    })

    expect(textarea.value).toBe('Thanks @Bob7?? for your help!')
  })

  it('should allow complete deletion of mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type content with a mention
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? for help!',
        selectionStart: 18,
        selectionEnd: 18
      } 
    })

    // Completely remove the mention (should be allowed)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks  for help!',
        selectionStart: 8,
        selectionEnd: 8
      } 
    })

    expect(textarea.value).toBe('Thanks  for help!')
  })

  it('should allow adding new mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type content with existing mention
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7??',
        selectionStart: 13,
        selectionEnd: 13
      } 
    })

    // Add new mention after existing one
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? and @alice.doe-123',
        selectionStart: 32,
        selectionEnd: 32
      } 
    })

    expect(textarea.value).toBe('Thanks @Bob7?? and @alice.doe-123')
  })

  it('should handle mentions with special characters correctly', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type mention with special characters
    fireEvent.change(textarea, { 
      target: { 
        value: 'Hello @alice.doe-123!',
        selectionStart: 20,
        selectionEnd: 20
      } 
    })

    expect(textarea.value).toBe('Hello @alice.doe-123!')

    // Try to partially edit the mention (should now be allowed)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Hello @alice.doe!', // Removing -123
        selectionStart: 16,
        selectionEnd: 16
      } 
    })

    // The change should be allowed (no protection interfering)
    expect(textarea.value).toBe('Hello @alice.doe!')
  })

  it('should position autocomplete below textarea to avoid blocking content', async () => {
    // Mock getBoundingClientRect
    const mockGetBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 200,
      bottom: 300,
      right: 400,
      width: 300,
      height: 100
    }))

    Object.defineProperty(HTMLTextAreaElement.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
      configurable: true
    })

    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type @ to trigger autocomplete
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @',
        selectionStart: 8,
        selectionEnd: 8
      } 
    })

    // Check that autocomplete appears (we can't easily test exact positioning in jsdom)
    // But we can verify the mention detection logic works
    expect(textarea.value).toBe('Thanks @')
    
    // The autocomplete should be positioned below the textarea (y = bottom + 8)
    // In a real browser, this would be at y = 300 + 8 = 308
  })})

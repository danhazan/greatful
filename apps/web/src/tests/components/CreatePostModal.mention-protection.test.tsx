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

  it('should prevent partial editing of completed mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Type a complete mention
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob7?? for help!',
        selectionStart: 18,
        selectionEnd: 18
      } 
    })

    expect(textarea.value).toBe('Thanks @Bob7?? for help!')

    // Try to edit inside the mention (position 10 is inside @Bob7??)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Thanks @Bob for help!', // Trying to remove the 7??
        selectionStart: 10,
        selectionEnd: 10
      } 
    })

    // The change should be prevented, content should remain the same
    await waitFor(() => {
      expect(textarea.value).toBe('Thanks @Bob7?? for help!')
    })
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

    // Try to partially edit the mention (should be prevented)
    fireEvent.change(textarea, { 
      target: { 
        value: 'Hello @alice.doe!', // Trying to remove -123
        selectionStart: 16,
        selectionEnd: 16
      } 
    })

    // The change should be prevented
    await waitFor(() => {
      expect(textarea.value).toBe('Hello @alice.doe-123!')
    })
  })
})
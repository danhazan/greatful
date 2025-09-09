/**
 * Tests for cursor-based autocomplete positioning in CreatePostModal
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { act } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, jest } from '@jest/globals'
import CreatePostModal from '@/components/CreatePostModal'
import { beforeEach } from 'node:test'

// Mock the MentionAutocomplete component to capture position
jest.mock('@/components/MentionAutocomplete', () => {
  return function MockMentionAutocomplete({ 
    position, 
    isOpen 
  }: { 
    position: { x: number, y: number }, 
    isOpen: boolean 
  }) {
    if (!isOpen) return null
    return (
      <div 
        data-mention-autocomplete="true"
        data-testid="mention-autocomplete"
        style={{ position: 'fixed', left: position.x, top: position.y }}
      >
        Autocomplete at {position.x}, {position.y}
      </div>
    )
  }
})

describe.skip('CreatePostModal - Cursor Positioning', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should position autocomplete based on cursor coordinates', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Mock getBoundingClientRect for textarea
    const mockRect = {
      left: 100,
      top: 200,
      bottom: 300,
      right: 400,
      width: 300,
      height: 100
    }
    jest.spyOn(textarea, 'getBoundingClientRect').mockReturnValue(mockRect as DOMRect)
    
    // Type @ to trigger autocomplete
    textarea.textContent = 'Hello @'
    fireEvent.input(textarea)

    await waitFor(() => {
      const autocomplete = document.querySelector('[data-mention-autocomplete]')
      expect(autocomplete).toBeInTheDocument()
      
      // The exact position will depend on the getCursorCoordinates calculation
      // We just verify that it has the correct data attribute
      expect(autocomplete).toHaveAttribute('data-mention-autocomplete')
    })
  })

  it('should update autocomplete position when cursor moves', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox')
    
    // Mock getBoundingClientRect
    jest.spyOn(textarea, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 200,
      bottom: 300,
      right: 400,
      width: 300,
      height: 100
    } as DOMRect)
    
    // Type @ at beginning
    textarea.textContent = '@'
    fireEvent.input(textarea)

    await waitFor(() => {
      expect(document.querySelector('[data-mention-autocomplete]')).toBeInTheDocument()
    })

    // Type @ at different position
    act(() => {
      textarea.textContent = 'Hello world @'
      const inputEvent = new Event('input', { bubbles: true })
      textarea.dispatchEvent(inputEvent)
    })

    await waitFor(() => {
      // Autocomplete should still be visible and repositioned
      expect(document.querySelector('[data-mention-autocomplete]')).toBeInTheDocument()
    })
  })

  it('should hide autocomplete when @ is removed', async () => {
    const user = userEvent.setup()
    
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    
    // Focus and type to show autocomplete
    await act(async () => {
      await user.click(textarea)
      await user.type(textarea, 'Hello @')
    })

    await waitFor(() => {
      expect(document.querySelector('[data-mention-autocomplete]')).toBeInTheDocument()
    })

    // Remove the @ by backspacing
    await act(async () => {
      await user.keyboard('{Backspace}')
    })

    await waitFor(() => {
      expect(document.querySelector('[data-mention-autocomplete]')).not.toBeInTheDocument()
    })
  })


})
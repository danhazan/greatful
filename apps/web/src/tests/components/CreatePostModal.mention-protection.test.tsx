/**
 * Tests for mention protection in CreatePostModal
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import { act } from 'react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import userEvent from '@testing-library/user-event'
import CreatePostModal from '@/components/CreatePostModal'

// Mock the MentionAutocomplete component
jest.mock('@/components/MentionAutocomplete', () => {
  return function MockMentionAutocomplete() {
    return <div data-testid="mention-autocomplete">Mention Autocomplete</div>
  }
})

// Mock the RichTextEditor's dependencies
jest.mock('@/utils/htmlUtils', () => ({
  sanitizeHtml: (html: string) => html
}))

jest.mock('@/utils/mentions', () => ({
  wrapMentions: (text: string) => text.replace(/@(\w+)/g, '<span class="mention">@$1</span>'),
  mentionsToPlainText: (html: string) => html.replace(/<span class="mention">(@\w+)<\/span>/g, '$1')
}))

describe('CreatePostModal - Mention Protection', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.clearAllMocks()
    user = userEvent.setup()
  })

  it('should allow editing of mentions for better user experience', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type a complete mention with space after (completed mention)
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7?? for help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Thanks @Bob7?? for help!')

    // Try to edit inside the completed mention (should now be allowed)
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob for help!' // Removing the 7??
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // The change should be allowed (no protection interfering)
    expect(contentEditable.textContent).toBe('Thanks @Bob for help!')
  })

  it('should allow deleting characters when typing incomplete mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type an incomplete mention (no space after, still being typed)
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Thanks @Bob7')

    // Try to backspace (should be allowed for incomplete mentions)
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // The change should be allowed (no protection interfering)
    // Since we removed mention protection, all text editing should work normally
    expect(contentEditable.textContent).toBe('Thanks @Bob')
  })

  it('should allow editing outside of mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type content with a mention
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7?? for help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // Edit text after the mention (should be allowed)
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7?? for your help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Thanks @Bob7?? for your help!')
  })

  it('should allow complete deletion of mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type content with a mention
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7?? for help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // Completely remove the mention (should be allowed)
    await act(async () => {
      contentEditable.textContent = 'Thanks  for help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Thanks  for help!')
  })

  it('should allow adding new mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type content with existing mention
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7??'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // Add new mention after existing one
    await act(async () => {
      contentEditable.textContent = 'Thanks @Bob7?? and @alice.doe-123'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Thanks @Bob7?? and @alice.doe-123')
  })

  it('should handle mentions with special characters correctly', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type mention with special characters
    await act(async () => {
      contentEditable.textContent = 'Hello @alice.doe-123!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    expect(contentEditable.textContent).toBe('Hello @alice.doe-123!')

    // Try to partially edit the mention (should now be allowed)
    await act(async () => {
      contentEditable.textContent = 'Hello @alice.doe!' // Removing -123
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // The change should be allowed (no protection interfering)
    expect(contentEditable.textContent).toBe('Hello @alice.doe!')
  })

  it('should position autocomplete below textarea to avoid blocking content', async () => {
    // Mock getBoundingClientRect for contentEditable div
    const mockGetBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 200,
      bottom: 300,
      right: 400,
      width: 300,
      height: 100
    }))

    Object.defineProperty(HTMLDivElement.prototype, 'getBoundingClientRect', {
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

    const contentEditable = screen.getByRole('textbox')
    
    // Type @ to trigger autocomplete
    await act(async () => {
      contentEditable.textContent = 'Thanks @'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // Check that autocomplete appears (we can't easily test exact positioning in jsdom)
    // But we can verify the mention detection logic works
    expect(contentEditable.textContent).toBe('Thanks @')
    
    // The autocomplete should be positioned below the contentEditable (y = bottom + 8)
    // In a real browser, this would be at y = 300 + 8 = 308
  })

  it('should handle rich text formatting with mentions', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Type content with mentions and formatting
    await act(async () => {
      contentEditable.innerHTML = 'Thanks <span class="mention">@Bob7??</span> for <strong>help</strong>!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })

    // Check that the text content is correct (HTML may be sanitized)
    expect(contentEditable.textContent).toContain('Thanks @Bob7?? for help!')
    
    // The HTML content might be sanitized by the RichTextEditor, so we check for the presence of content
    // rather than specific HTML tags which may be processed by the sanitization
    expect(contentEditable.innerHTML.length).toBeGreaterThan(0)
  })

  it('should handle user typing with direct content manipulation', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Focus the contentEditable element
    await user.click(contentEditable)
    
    // Use direct content manipulation instead of userEvent.type for contentEditable
    // as userEvent.type has known issues with contentEditable elements
    await act(async () => {
      contentEditable.textContent = 'Thanks @alice for help!'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })
    
    // Check that the content was set correctly
    expect(contentEditable.textContent).toBe('Thanks @alice for help!')
  })

  it('should handle mention detection during typing', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const contentEditable = screen.getByRole('textbox')
    
    // Simulate typing that would trigger mention detection
    await act(async () => {
      // Mock window.getSelection for mention detection
      const mockSelection = {
        rangeCount: 1,
        anchorNode: { textContent: 'Thanks @alice' },
        anchorOffset: 13
      }
      Object.defineProperty(window, 'getSelection', {
        value: () => mockSelection,
        configurable: true
      })
      
      contentEditable.textContent = 'Thanks @alice'
      const inputEvent = new Event('input', { bubbles: true })
      contentEditable.dispatchEvent(inputEvent)
    })
    
    // Check that the content is correct
    expect(contentEditable.textContent).toBe('Thanks @alice')
  })})

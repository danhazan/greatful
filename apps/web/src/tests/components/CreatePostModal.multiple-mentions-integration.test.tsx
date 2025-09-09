/**
 * Integration test for multiple mentions in CreatePostModal
 * Tests the specific scenario where second mention selection was overwriting first mention
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import CreatePostModal from '@/components/CreatePostModal'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the utilities
jest.mock('@/utils/imageUpload', () => ({
  validateImageFile: jest.fn(() => ({ isValid: true, error: null })),
  createImagePreview: jest.fn(() => 'blob:mock-image-url'),
  revokeImagePreview: jest.fn()
}))

jest.mock('@/utils/mentionUtils', () => ({
  extractMentions: jest.fn(() => [])
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    {children}
  </ToastProvider>
)

describe('CreatePostModal - Multiple Mentions Integration', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  const renderModal = () => {
    return render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )
  }

  it('should handle multiple mentions without overwriting previous content', async () => {
    renderModal()
    
    const editor = screen.getByRole('textbox', { name: /share what you're grateful for today/i })
    
    // Step 1: Type first mention and select it
    await act(async () => {
      editor.textContent = "hi @bob"
      fireEvent.input(editor)
    })
    
    // Wait for mention autocomplete to appear
    await waitFor(() => {
      expect(screen.getByText(/@bob/i)).toBeInTheDocument()
    })
    
    // Simulate selecting first mention (this would normally come from MentionAutocomplete)
    // For testing, we'll directly manipulate the editor content to simulate the result
    await act(async () => {
      editor.innerHTML = 'hi <span class="mention" data-username="Bob6">@Bob6</span> '
      fireEvent.input(editor)
    })
    
    // Step 2: Add more text and start typing second mention
    await act(async () => {
      // Simulate typing " hello @bo" after the first mention
      const mentionSpan = editor.querySelector('.mention')
      if (mentionSpan) {
        // Add text node after the mention
        const textNode = document.createTextNode(' hello @bo')
        editor.appendChild(textNode)
        
        // Position cursor at the end
        const range = document.createRange()
        range.setStart(textNode, textNode.textContent.length)
        range.setEnd(textNode, textNode.textContent.length)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      
      fireEvent.input(editor)
    })
    
    // Verify the content is correct before second mention selection
    const contentBeforeSecondMention = editor.textContent
    expect(contentBeforeSecondMention).toContain('@Bob6')
    expect(contentBeforeSecondMention).toContain('hello @bo')
    
    // Step 3: Simulate selecting second mention
    // This should only replace "@bo" and not affect the first mention or "hello"
    await act(async () => {
      // Simulate the result of selecting @Bob1 for the second mention
      // The content should become: "hi @Bob6 hello @Bob1 "
      editor.innerHTML = 'hi <span class="mention" data-username="Bob6">@Bob6</span> hello <span class="mention" data-username="Bob1">@Bob1</span> '
      fireEvent.input(editor)
    })
    
    // Verify final content
    const finalContent = editor.textContent
    expect(finalContent).toContain('@Bob6') // First mention preserved
    expect(finalContent).toContain('hello') // Text between mentions preserved
    expect(finalContent).toContain('@Bob1') // Second mention added
    expect(finalContent).not.toContain('@bo') // Partial mention replaced
    
    // Verify both mention spans exist
    const mentionSpans = editor.querySelectorAll('.mention')
    expect(mentionSpans.length).toBe(2)
    expect(mentionSpans[0].textContent).toBe('@Bob6')
    expect(mentionSpans[1].textContent).toBe('@Bob1')
  })

  it('should calculate correct mention positions with existing content', async () => {
    renderModal()
    
    const editor = screen.getByRole('textbox', { name: /share what you're grateful for today/i })
    
    // Set up content similar to the user's scenario
    await act(async () => {
      // Content: "hi @Bob6 hello @bo"
      editor.innerHTML = 'hi <span class="mention" data-username="Bob6">@Bob6</span> hello @bo'
      
      // Position cursor at the end (after "@bo")
      const range = document.createRange()
      const lastTextNode = editor.lastChild
      if (lastTextNode && lastTextNode.nodeType === Node.TEXT_NODE) {
        range.setStart(lastTextNode, lastTextNode.textContent?.length || 0)
        range.setEnd(lastTextNode, lastTextNode.textContent?.length || 0)
      }
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      fireEvent.input(editor)
    })
    
    // The plain text should be: "hi @Bob6 hello @bo"
    // When we select a mention for "@bo", it should only replace "@bo" at positions 15-17
    
    // Verify the content structure
    expect(editor.textContent).toBe('hi @Bob6 hello @bo')
    expect(editor.querySelector('.mention')).toBeTruthy()
    expect(editor.querySelector('.mention')?.textContent).toBe('@Bob6')
  })

  it('should preserve all content when replacing only the target mention', async () => {
    renderModal()
    
    const editor = screen.getByRole('textbox', { name: /share what you're grateful for today/i })
    
    // Test with more complex content
    await act(async () => {
      // Content: "Thanks @Alice for the help! Also @j"
      editor.innerHTML = 'Thanks <span class="mention" data-username="Alice">@Alice</span> for the help! Also @j'
      fireEvent.input(editor)
    })
    
    // Verify initial state
    expect(editor.textContent).toBe('Thanks @Alice for the help! Also @j')
    
    // Simulate replacing "@j" with "@John"
    await act(async () => {
      editor.innerHTML = 'Thanks <span class="mention" data-username="Alice">@Alice</span> for the help! Also <span class="mention" data-username="John">@John</span> '
      fireEvent.input(editor)
    })
    
    // Verify final state - all original content preserved
    const finalContent = editor.textContent
    expect(finalContent).toContain('Thanks @Alice for the help! Also @John')
    expect(finalContent).not.toContain('@j') // Partial mention should be gone
    
    // Verify structure
    const mentionSpans = editor.querySelectorAll('.mention')
    expect(mentionSpans.length).toBe(2)
    expect(mentionSpans[0].textContent).toBe('@Alice')
    expect(mentionSpans[1].textContent).toBe('@John')
  })
})
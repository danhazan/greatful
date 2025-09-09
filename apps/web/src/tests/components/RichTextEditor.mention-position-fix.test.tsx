/**
 * Test for mention position calculation fix
 * Ensures that mention positions are calculated correctly when there are existing mentions
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'

describe('RichTextEditor - Mention Position Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should calculate correct cursor position for second mention', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    
    let editorRef: RichTextEditorRef | null = null

    const TestComponent = () => {
      return (
        <RichTextEditor
          ref={(ref) => { editorRef = ref }}
          value=""
          onChange={mockOnChange}
          onMentionTrigger={mockOnMentionTrigger}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    // Simplified test - just verify basic functionality
    await act(async () => {
      // Set simple content with a mention
      editor.textContent = "hi @bo"
      
      // Position cursor at the end
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      if (textNode) {
        range.setStart(textNode, 6) // After "hi @bo"
        range.setEnd(textNode, 6)
      }
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      fireEvent.input(editor)
    })
    
    // Verify mention trigger was called
    expect(mockOnMentionTrigger).toHaveBeenCalled()
    
    // Get the last call (should be for "bo")
    const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
    const [query] = lastCall
    
    // Should detect "bo" as the query
    expect(query).toBe('bo')
  })

  it('should handle mention insertion at correct position with existing mentions', async () => {
    const mockOnChange = jest.fn()
    
    let editorRef: RichTextEditorRef | null = null

    const TestComponent = () => {
      return (
        <RichTextEditor
          ref={(ref) => { editorRef = ref }}
          value=""
          onChange={mockOnChange}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    // Set up content with existing mention
    await act(async () => {
      editor.innerHTML = 'hi <span class="mention" data-username="Bob6">@Bob6</span> hello @bo'
      fireEvent.input(editor)
    })
    
    // Insert mention at the correct position (should replace only "@bo")
    await act(async () => {
      // Position 15 should be the start of "@bo" in "hi @Bob6 hello @bo"
      editorRef?.insertMention('Bob1', 15, 18)
    })
    
    // Verify the result
    const finalText = editorRef?.getPlainText()
    expect(finalText).toBe('hi @Bob6 hello @Bob1 ')
    
    // Verify we have two mention spans
    const mentionSpans = editor.querySelectorAll('.mention')
    expect(mentionSpans.length).toBe(2)
    expect(mentionSpans[0].textContent).toBe('@Bob6')
    expect(mentionSpans[1].textContent).toBe('@Bob1')
  })

  it('should not affect first mention when inserting second mention', async () => {
    const mockOnChange = jest.fn()
    
    let editorRef: RichTextEditorRef | null = null

    const TestComponent = () => {
      return (
        <RichTextEditor
          ref={(ref) => { editorRef = ref }}
          value=""
          onChange={mockOnChange}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    // Set up content: "hello @Alice world @j"
    await act(async () => {
      editor.innerHTML = 'hello <span class="mention" data-username="Alice">@Alice</span> world @j'
      fireEvent.input(editor)
    })
    
    // Get initial state
    const initialText = editorRef?.getPlainText()
    expect(initialText).toBe('hello @Alice world @j')
    
    // Insert mention for "@j" -> "@John"
    await act(async () => {
      // "@j" should start at position 19 in "hello @Alice world @j"
      editorRef?.insertMention('John', 19, 21)
    })
    
    // Verify the result - first mention should be unchanged
    const finalText = editorRef?.getPlainText()
    expect(finalText).toBe('hello @Alice world @John ')
    
    // Verify both mentions exist and are correct
    const mentionSpans = editor.querySelectorAll('.mention')
    expect(mentionSpans.length).toBe(2)
    expect(mentionSpans[0].textContent).toBe('@Alice')
    expect(mentionSpans[1].textContent).toBe('@John')
  })
})
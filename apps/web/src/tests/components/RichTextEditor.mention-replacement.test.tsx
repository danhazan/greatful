/**
 * Test for mention replacement functionality
 * Ensures that when a user types "@bo" and selects "Bob1" from autocomplete,
 * the result is "@Bob1" not "@bo@Bob1"
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'

describe('RichTextEditor - Mention Replacement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should replace partial mention text with complete username', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    const mockOnMentionHide = jest.fn()
    
    let editorRef: RichTextEditorRef | null = null

    const TestComponent = () => {
      return (
        <RichTextEditor
          ref={(ref) => { editorRef = ref }}
          value=""
          onChange={mockOnChange}
          onMentionTrigger={mockOnMentionTrigger}
          onMentionHide={mockOnMentionHide}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    expect(editor).toBeTruthy()
    expect(editorRef).toBeTruthy()
    
    await act(async () => {
      // Simulate user typing "@bo"
      editor.focus()
      
      // Type "@bo" character by character
      editor.textContent = "@"
      fireEvent.input(editor, { target: { textContent: "@" } })
      
      editor.textContent = "@b"
      fireEvent.input(editor, { target: { textContent: "@b" } })
      
      editor.textContent = "@bo"
      fireEvent.input(editor, { target: { textContent: "@bo" } })
      
      // Position cursor at the end
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      range.setStart(textNode, 3) // After "@bo"
      range.setEnd(textNode, 3)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    
    // Verify the initial content is correct
    expect(editor.textContent).toBe('@bo')
    
    await act(async () => {
      // Simulate selecting "Bob1" from autocomplete
      // The mention starts at position 0 (@) and ends at position 3 (after "bo")
      // This matches how CreatePostModal calculates the positions
      editorRef?.insertMention('Bob1', 0, 3)
    })
    
    // Verify the final content is correct - should be "@Bob1 " not "@bo@Bob1 "
    expect(editor.textContent?.trim()).toBe('@Bob1')
    
    // Verify onChange was called with correct content
    expect(mockOnChange).toHaveBeenCalled()
    const lastChangeCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
    expect(lastChangeCall[0]).toBe('@Bob1 ') // plain text with space
    expect(lastChangeCall[1]).toContain('Bob1') // HTML should contain the username
  })

  it('should handle mention replacement in middle of text', async () => {
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
    
    await act(async () => {
      // Set initial text with mention in the middle
      editor.textContent = "Hello @bo world"
      fireEvent.input(editor, { target: { textContent: "Hello @bo world" } })
      
      // Position cursor after "@bo"
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      range.setStart(textNode, 9) // After "Hello @bo"
      range.setEnd(textNode, 9)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
    
    await act(async () => {
      // Insert mention - should replace "@bo" with "@Bob1"
      // mentionStart=6 (position of @), mentionEnd=9 (after "bo")
      editorRef?.insertMention('Bob1', 6, 9)
    })
    
    // Should be "Hello @Bob1  world" (note the extra space after mention)
    expect(editor.textContent?.replace(/\s+/g, ' ').trim()).toBe('Hello @Bob1 world')
  })

  it('should handle mention replacement when @ is in the middle', async () => {
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
    
    await act(async () => {
      // Set text where user typed partial mention with @ in middle
      editor.textContent = "Hello @bo there"
      fireEvent.input(editor, { target: { textContent: "Hello @bo there" } })
    })
    
    await act(async () => {
      // Insert mention - should replace "@bo" with "@Bob1"
      // mentionStart=6 (position of @), mentionEnd=9 (after "bo")
      editorRef?.insertMention('Bob1', 6, 9)
    })
    
    // Should be "Hello @Bob1  there"
    expect(editor.textContent?.replace(/\s+/g, ' ').trim()).toBe('Hello @Bob1 there')
  })

  it('should handle edge case with multiple @ symbols', async () => {
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
    
    await act(async () => {
      // Set text with multiple @ symbols
      editor.textContent = "Email me @ test@example.com or @bo"
      fireEvent.input(editor, { target: { textContent: "Email me @ test@example.com or @bo" } })
    })
    
    await act(async () => {
      // Insert mention for the last @bo
      // mentionStart=31 (position of last @), mentionEnd=34 (after "bo")
      editorRef?.insertMention('Bob1', 31, 34)
    })
    
    // Should preserve the email and replace only the mention
    expect(editor.textContent?.trim()).toBe('Email me @ test@example.com or @Bob1')
  })
})
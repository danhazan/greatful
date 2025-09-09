/**
 * Test for mention dropdown appearing after completed mentions bug fix
 * Ensures that mention dropdown doesn't appear when typing after a completed mention
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'

describe('RichTextEditor - Mention Dropdown Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not trigger mention dropdown when typing after a completed mention', async () => {
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
    
    // Step 1: Set up content with a completed mention
    await act(async () => {
      // Content: "@Bob1 aw" where @Bob1 is a completed mention span
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> aw'
      
      // Position cursor at the end (after "aw")
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
    
    // With the simplified logic, typing "aw" after a mention should not trigger mention detection
    // since "aw" doesn't contain "@"
    expect(mockOnMentionTrigger).not.toHaveBeenCalled()
  })

  it('should not trigger mention dropdown when cursor is inside a mention span', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    const mockOnMentionHide = jest.fn()
    
    const TestComponent = () => {
      return (
        <RichTextEditor
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
    
    // Set up content with cursor inside a mention span
    await act(async () => {
      editor.innerHTML = 'Hello <span class="mention" data-username="Bob1">@Bob1</span> world'
      
      // Position cursor inside the mention span
      const mentionSpan = editor.querySelector('.mention')
      if (mentionSpan && mentionSpan.firstChild) {
        const range = document.createRange()
        range.setStart(mentionSpan.firstChild, 2) // Inside "@Bob1"
        range.setEnd(mentionSpan.firstChild, 2)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      
      fireEvent.input(editor)
    })
    
    // Verify mention trigger was NOT called (cursor is inside mention span)
    expect(mockOnMentionTrigger).not.toHaveBeenCalled()
    
    // Verify mention hide was called (to hide dropdown when inside mention)
    expect(mockOnMentionHide).toHaveBeenCalled()
  })

  it('should trigger mention dropdown for new @ symbols after completed mentions', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    const mockOnMentionHide = jest.fn()
    
    const TestComponent = () => {
      return (
        <RichTextEditor
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
    
    // Set up content with a new mention after a completed one
    await act(async () => {
      // Content: "@Bob1 hello @al" where @Bob1 is completed and @al is new
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> hello @al'
      
      // Position cursor at the end (after "@al")
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
    
    // Verify mention trigger WAS called for the new "@al" mention
    expect(mockOnMentionTrigger).toHaveBeenCalled()
    
    // Get the last call and verify it detected "al"
    const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
    expect(lastCall[0]).toBe('al')
  })

  it('should handle typing immediately after a mention span', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    const mockOnMentionHide = jest.fn()
    
    const TestComponent = () => {
      return (
        <RichTextEditor
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
    
    // Set up content where cursor is at the very start of text after a mention
    await act(async () => {
      // Content: "@Bob1 awesome" where cursor is right after the space
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> awesome'
      
      // Position cursor at the start of " awesome" text node
      const textNode = editor.lastChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange()
        range.setStart(textNode, 1) // After the space, before "awesome"
        range.setEnd(textNode, 1)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      
      fireEvent.input(editor)
    })
    
    // Should not trigger mention dropdown when typing regular text (no @ symbol)
    expect(mockOnMentionTrigger).not.toHaveBeenCalled()
  })

  it('should trigger mention dropdown for @ at start of text node after mention', async () => {
    const mockOnChange = jest.fn()
    const mockOnMentionTrigger = jest.fn()
    const mockOnMentionHide = jest.fn()
    
    const TestComponent = () => {
      return (
        <RichTextEditor
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
    
    // Set up content where we type @ at the start of a new text node
    await act(async () => {
      // Content: "@Bob1 @test" where @Bob1 is completed and @test is new
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> @test'
      
      // Position cursor after "@test"
      const textNode = editor.lastChild
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const range = document.createRange()
        range.setStart(textNode, textNode.textContent?.length || 0)
        range.setEnd(textNode, textNode.textContent?.length || 0)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      
      fireEvent.input(editor)
    })
    
    // Should trigger mention dropdown for the new "@test"
    expect(mockOnMentionTrigger).toHaveBeenCalled()
    
    const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
    expect(lastCall[0]).toBe('test')
  })
})
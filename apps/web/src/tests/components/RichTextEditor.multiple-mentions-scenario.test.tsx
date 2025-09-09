/**
 * Test for the specific scenario from user's screenshot
 * "@Bob1 gi @b" should trigger autocomplete for "@b"
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'

describe('RichTextEditor - Multiple Mentions Scenario', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should trigger autocomplete for second mention in "@Bob1 gi @b" scenario', async () => {
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
    
    // Simulate the exact scenario from the screenshot: "@Bob1 gi @b"
    await act(async () => {
      // Set up content with first mention completed and second mention being typed
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> gi @b'
      
      // Position cursor at the end (after "@b")
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
    
    // Verify mention trigger WAS called for "@b"
    expect(mockOnMentionTrigger).toHaveBeenCalled()
    
    // Get the last call and verify it detected "b"
    const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
    expect(lastCall[0]).toBe('b')
    
    // Verify the content structure
    expect(editor.textContent).toBe('@Bob1 gi @b')
    expect(editor.querySelector('.mention')).toBeTruthy()
    expect(editor.querySelector('.mention')?.textContent).toBe('@Bob1')
  })

  it('should handle multiple mentions with various text in between', async () => {
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
    
    // Test various scenarios with text between mentions
    const scenarios = [
      {
        content: '<span class="mention" data-username="Alice">@Alice</span> hello @j',
        expectedQuery: 'j',
        description: 'single word between mentions'
      },
      {
        content: '<span class="mention" data-username="Bob">@Bob</span> and <span class="mention" data-username="Carol">@Carol</span> @test',
        expectedQuery: 'test',
        description: 'multiple mentions with new one'
      },
      {
        content: 'Thanks <span class="mention" data-username="Team">@Team</span> for the great work! @a',
        expectedQuery: 'a',
        description: 'mention at start with text and new mention'
      }
    ]

    for (const scenario of scenarios) {
      // Clear previous calls
      mockOnMentionTrigger.mockClear()
      
      await act(async () => {
        editor.innerHTML = scenario.content
        
        // Position cursor at the end
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
      
      // Verify mention trigger was called for each scenario
      expect(mockOnMentionTrigger).toHaveBeenCalled()
      
      const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
      expect(lastCall[0]).toBe(scenario.expectedQuery)
    }
  })

  it('should not trigger when typing regular text after mentions', async () => {
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
    
    // Test typing regular text (no @) after mentions
    await act(async () => {
      editor.innerHTML = '<span class="mention" data-username="Bob1">@Bob1</span> awesome work'
      
      // Position cursor at the end
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
    
    // Should not trigger mention dropdown for regular text
    expect(mockOnMentionTrigger).not.toHaveBeenCalled()
  })
})
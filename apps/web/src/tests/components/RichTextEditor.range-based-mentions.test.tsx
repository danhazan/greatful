/**
 * Integration test for range-based mention handling
 * Tests the specific "@Bob1 gi @b" scenario and other complex mention cases
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor, { RichTextEditorRef } from '@/components/RichTextEditor'

describe('RichTextEditor - Range-based Mentions Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should handle "@Bob1 gi @b" scenario with range-based detection', async () => {
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
    
    // Step 1: Insert first mention using the new range-based approach
    await act(async () => {
      // Simulate typing "@Bob1"
      editor.innerHTML = '@Bob1'
      
      // Position cursor at end
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      range.setStart(textNode, 5) // After "@Bob1"
      range.setEnd(textNode, 5)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      fireEvent.input(editor)
    })
    
    // Verify first mention was detected
    expect(mockOnMentionTrigger).toHaveBeenCalledWith('Bob1', expect.any(Object), 5)
    
    // Step 2: Insert the first mention using the new insertMention method
    await act(async () => {
      editorRef?.insertMention('Bob1', 0, 5) // Replace "@Bob1" with mention span
    })
    
    // Verify the mention span was created correctly
    const mentionSpan = editor.querySelector('.mention')
    expect(mentionSpan).toBeTruthy()
    expect(mentionSpan?.textContent).toBe('@Bob1')
    expect(mentionSpan?.getAttribute('data-username')).toBe('Bob1')
    expect(mentionSpan?.getAttribute('contenteditable')).toBe('false')
    
    // Step 3: Type " gi @b" after the mention
    await act(async () => {
      // Simulate typing additional text by appending to the editor
      const additionalText = document.createTextNode('gi @b')
      editor.appendChild(additionalText)
      
      // Position cursor at the end (after "@b")
      const range = document.createRange()
      range.setStart(additionalText, additionalText.textContent?.length || 0)
      range.setEnd(additionalText, additionalText.textContent?.length || 0)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      // Clear previous calls to focus on the new mention
      mockOnMentionTrigger.mockClear()
      
      fireEvent.input(editor)
    })
    
    // Step 4: Verify second mention "@b" was detected
    expect(mockOnMentionTrigger).toHaveBeenCalled()
    const lastCall = mockOnMentionTrigger.mock.calls[mockOnMentionTrigger.mock.calls.length - 1]
    expect(lastCall[0]).toBe('b') // Should detect "b" from "@b"
    
    // Verify the full content structure
    expect(editor.textContent).toContain('@Bob1')
    expect(editor.textContent).toContain('gi @b')
    expect(editor.querySelector('.mention')?.textContent).toBe('@Bob1')
  })

  it('should handle multiple mentions with range-based insertion', async () => {
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
    
    // Insert multiple mentions sequentially
    const mentions = ['Alice', 'Bob', 'Carol']
    
    for (let i = 0; i < mentions.length; i++) {
      const username = mentions[i]
      
      await act(async () => {
        // Add text for the mention
        const mentionText = `@${username}`
        const textNode = document.createTextNode(i === 0 ? mentionText : ` ${mentionText}`)
        editor.appendChild(textNode)
        
        // Position cursor at end
        const range = document.createRange()
        range.setStart(textNode, textNode.textContent?.length || 0)
        range.setEnd(textNode, textNode.textContent?.length || 0)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        fireEvent.input(editor)
      })
      
      // Insert the mention using range-based approach
      await act(async () => {
        const fullText = editor.textContent || ''
        const mentionStart = fullText.lastIndexOf(`@${username}`)
        const mentionEnd = mentionStart + username.length + 1 // +1 for @
        
        editorRef?.insertMention(username, mentionStart, mentionEnd)
      })
    }
    
    // Verify all mentions were created
    const mentionSpans = editor.querySelectorAll('.mention')
    expect(mentionSpans.length).toBe(3)
    
    mentions.forEach((username, index) => {
      expect(mentionSpans[index].textContent).toBe(`@${username}`)
      expect(mentionSpans[index].getAttribute('data-username')).toBe(username)
    })
    
    // Test typing after the last mention
    await act(async () => {
      const newText = document.createTextNode(' @test')
      editor.appendChild(newText)
      
      const range = document.createRange()
      range.setStart(newText, newText.textContent?.length || 0)
      range.setEnd(newText, newText.textContent?.length || 0)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      mockOnMentionTrigger.mockClear()
      fireEvent.input(editor)
    })
    
    // Verify new mention was detected
    expect(mockOnMentionTrigger).toHaveBeenCalledWith('test', expect.any(Object), expect.any(Number))
  })

  it('should not trigger when cursor is inside mention span', async () => {
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
    
    // Set up content with a mention span
    await act(async () => {
      editor.innerHTML = 'Hello <span class="mention" data-username="Bob" contenteditable="false">@Bob</span> world'
      
      // Position cursor inside the mention span (this should be prevented by contenteditable="false")
      const mentionSpan = editor.querySelector('.mention')
      if (mentionSpan && mentionSpan.firstChild) {
        const range = document.createRange()
        range.setStart(mentionSpan.firstChild, 2) // Inside "@Bob"
        range.setEnd(mentionSpan.firstChild, 2)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      
      fireEvent.input(editor)
    })
    
    // Should hide mention dropdown when cursor is inside mention
    expect(mockOnMentionHide).toHaveBeenCalled()
    expect(mockOnMentionTrigger).not.toHaveBeenCalled()
  })

  it('should handle cursor positioning after mention insertion', async () => {
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
    
    // Insert a mention
    await act(async () => {
      editor.textContent = '@Alice'
      
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      range.setStart(textNode, 6)
      range.setEnd(textNode, 6)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      editorRef?.insertMention('Alice', 0, 6)
    })
    
    // Verify cursor is positioned after the mention
    const selection = window.getSelection()
    expect(selection?.rangeCount).toBe(1)
    
    const range = selection?.getRangeAt(0)
    expect(range?.collapsed).toBe(true) // Cursor should be collapsed (not selecting text)
    
    // The cursor should be after the space that follows the mention
    const mentionSpan = editor.querySelector('.mention')
    expect(mentionSpan?.nextSibling).toBeTruthy() // Should have a space after
    
    // Test typing after the mention
    await act(async () => {
      const newText = document.createTextNode('hello @Bob')
      editor.appendChild(newText)
      
      const newRange = document.createRange()
      newRange.setStart(newText, newText.textContent?.length || 0)
      newRange.setEnd(newText, newText.textContent?.length || 0)
      
      selection?.removeAllRanges()
      selection?.addRange(newRange)
      
      mockOnMentionTrigger.mockClear()
      fireEvent.input(editor)
    })
    
    // Should detect the new mention
    expect(mockOnMentionTrigger).toHaveBeenCalledWith('Bob', expect.any(Object), expect.any(Number))
  })

  it('should preserve DOM structure during mention insertion', async () => {
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
    
    // Set up complex DOM structure
    await act(async () => {
      editor.innerHTML = 'Hello <strong>world</strong> @Alice and <em>more</em> text'
      
      // Position cursor after "@Alice"
      const textNodes = []
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      let node
      while (node = walker.nextNode()) {
        textNodes.push(node)
      }
      
      // Find the text node containing "@Alice"
      const aliceTextNode = textNodes.find(n => n.textContent?.includes('@Alice'))
      if (aliceTextNode) {
        const range = document.createRange()
        const aliceIndex = aliceTextNode.textContent?.indexOf('@Alice') || 0
        range.setStart(aliceTextNode, aliceIndex + 6) // After "@Alice"
        range.setEnd(aliceTextNode, aliceIndex + 6)
        
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        // Calculate the position in the full text
        let fullTextPosition = 0
        for (const textNode of textNodes) {
          if (textNode === aliceTextNode) {
            fullTextPosition += aliceIndex + 6
            break
          }
          fullTextPosition += textNode.textContent?.length || 0
        }
        
        editorRef?.insertMention('Alice', fullTextPosition - 6, fullTextPosition)
      }
    })
    
    // Verify the DOM structure was preserved
    expect(editor.querySelector('strong')).toBeTruthy()
    expect(editor.querySelector('em')).toBeTruthy()
    expect(editor.querySelector('.mention')).toBeTruthy()
    
    // Verify the mention was inserted correctly
    const mentionSpan = editor.querySelector('.mention')
    expect(mentionSpan?.textContent).toBe('@Alice')
    expect(mentionSpan?.getAttribute('data-username')).toBe('Alice')
    
    // Verify other elements are still present
    expect(editor.querySelector('strong')?.textContent).toBe('world')
    expect(editor.querySelector('em')?.textContent).toBe('more')
  })
})
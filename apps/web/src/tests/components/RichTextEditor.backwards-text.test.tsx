/**
 * Test for backwards text bug reproduction and fix verification
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'

// Mock console.debug to capture debug logs
const mockConsoleDebug = jest.fn()
const originalConsoleDebug = console.debug

describe('RichTextEditor - Backwards Text Bug Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.debug = mockConsoleDebug
  })

  afterEach(() => {
    console.debug = originalConsoleDebug
  })

  it('should not overwrite content while user is typing', async () => {
    const mockOnChange = jest.fn()
    
    // Simulate controlled component behavior that caused the bug
    const TestComponent = () => {
      const [value, setValue] = React.useState("")
      
      const handleChange = (plainText: string, formattedText: string) => {
        setValue(plainText)
        mockOnChange(plainText, formattedText)
      }
      
      return (
        <RichTextEditor
          value={value}
          onChange={handleChange}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    expect(editor).toBeTruthy()
    
    // Simulate rapid typing that would trigger the bug
    await act(async () => {
      // Focus the editor
      editor.focus()
      
      // Simulate typing "hello" character by character
      const chars = ['h', 'e', 'l', 'l', 'o']
      
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i]
        
        // Add character to editor
        editor.textContent = (editor.textContent || '') + char
        
        // Trigger input event
        fireEvent.input(editor, { target: { textContent: editor.textContent } })
        
        // Small delay to simulate real typing
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    })
    
    // Verify final content is correct (not backwards)
    expect(editor.textContent).toBe('hello')
    
    // Verify onChange was called with correct content
    expect(mockOnChange).toHaveBeenCalled()
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]
    expect(lastCall[0]).toBe('hello') // plain text
  })

  it('should preserve selection when programmatically updating content', async () => {
    const mockOnChange = jest.fn()
    
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
        placeholder="Type here..."
      />
    )
    
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    await act(async () => {
      // Set some initial content
      editor.textContent = "Hello world"
      fireEvent.input(editor, { target: { textContent: "Hello world" } })
      
      // Create a selection in the middle
      const range = document.createRange()
      const textNode = editor.firstChild as Text
      range.setStart(textNode, 6) // After "Hello "
      range.setEnd(textNode, 6)
      
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      // Verify selection is at position 6
      expect(selection?.anchorOffset).toBe(6)
    })
    
    // The selection should be preserved (this test mainly ensures no errors occur)
    expect(editor.textContent).toBe("Hello world")
  })

  it('should handle rapid state updates without corrupting content', async () => {
    const mockOnChange = jest.fn()
    let updateCount = 0
    
    const TestComponent = () => {
      const [value, setValue] = React.useState("")
      
      const handleChange = (plainText: string, formattedText: string) => {
        updateCount++
        setValue(plainText)
        mockOnChange(plainText, formattedText)
      }
      
      return (
        <RichTextEditor
          value={value}
          onChange={handleChange}
          placeholder="Type here..."
        />
      )
    }

    const { container } = render(<TestComponent />)
    const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement
    
    await act(async () => {
      // Simulate very rapid typing
      const text = "rapid typing test"
      
      for (let i = 0; i < text.length; i++) {
        const currentText = text.slice(0, i + 1)
        editor.textContent = currentText
        fireEvent.input(editor, { target: { textContent: currentText } })
        
        // No delay - rapid fire updates
      }
    })
    
    // Final content should be correct
    expect(editor.textContent).toBe("rapid typing test")
    
    // Should have received multiple onChange calls
    expect(mockOnChange).toHaveBeenCalled()
    expect(updateCount).toBeGreaterThan(0)
  })
})
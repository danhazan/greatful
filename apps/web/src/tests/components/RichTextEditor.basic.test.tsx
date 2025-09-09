import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'

describe('RichTextEditor - Basic Functionality', () => {
  it('should render with contentEditable div', () => {
    render(
      <RichTextEditor
        onChange={() => {}}
        placeholder="Test placeholder"
      />
    )

    const editor = screen.getByRole('textbox')
    expect(editor).toBeInTheDocument()
    expect(editor).toHaveAttribute('contentEditable', 'true')
    expect(editor).toHaveAttribute('aria-label', 'Test placeholder')
  })

  it('should render toolbar with formatting buttons', () => {
    render(
      <RichTextEditor
        onChange={() => {}}
      />
    )

    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    expect(screen.getByTitle('Italic')).toBeInTheDocument()
    expect(screen.getByTitle('Underline')).toBeInTheDocument()
    expect(screen.getByTitle('Text Color')).toBeInTheDocument()
    expect(screen.getByTitle('Background Color')).toBeInTheDocument()
    expect(screen.getByTitle('Add Emoji')).toBeInTheDocument()
  })

  it('should initialize with HTML content when htmlValue is provided', () => {
    const htmlContent = '<strong>Bold text</strong> and <em>italic text</em>'
    
    render(
      <RichTextEditor
        htmlValue={htmlContent}
        onChange={() => {}}
      />
    )

    const editor = screen.getByRole('textbox')
    expect(editor.innerHTML).toContain('<strong>Bold text</strong>')
    expect(editor.innerHTML).toContain('<em>italic text</em>')
  })

  it('should initialize with plain text when only value is provided', () => {
    const plainText = 'Plain text content'
    
    render(
      <RichTextEditor
        value={plainText}
        onChange={() => {}}
      />
    )

    const editor = screen.getByRole('textbox')
    expect(editor.textContent).toBe(plainText)
  })
})
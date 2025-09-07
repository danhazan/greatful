import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'

describe('RichTextEditor', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders basic text editor', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
        placeholder="Test placeholder"
      />
    )

    expect(screen.getByPlaceholderText('Test placeholder')).toBeInTheDocument()
  })

  it('calls onChange with plain text when no formatting is applied', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello world' } })

    expect(mockOnChange).toHaveBeenCalledWith('Hello world', 'Hello world')
  })

  it('generates HTML when bold formatting is applied', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    // Click bold button
    const boldButton = screen.getByTitle('Bold')
    fireEvent.click(boldButton)

    // Type text
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Bold text' } })

    expect(mockOnChange).toHaveBeenCalledWith('Bold text', '<strong>Bold text</strong>')
  })

  it('generates HTML when italic formatting is applied', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    // Click italic button
    const italicButton = screen.getByTitle('Italic')
    fireEvent.click(italicButton)

    // Type text
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Italic text' } })

    expect(mockOnChange).toHaveBeenCalledWith('Italic text', '<em>Italic text</em>')
  })

  it('generates HTML when underline formatting is applied', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    // Click underline button
    const underlineButton = screen.getByTitle('Underline')
    fireEvent.click(underlineButton)

    // Type text
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Underlined text' } })

    expect(mockOnChange).toHaveBeenCalledWith('Underlined text', '<u>Underlined text</u>')
  })

  it('generates HTML with multiple formatting options', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    // Click bold and italic buttons
    const boldButton = screen.getByTitle('Bold')
    const italicButton = screen.getByTitle('Italic')
    fireEvent.click(boldButton)
    fireEvent.click(italicButton)

    // Type text
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Bold and italic' } })

    expect(mockOnChange).toHaveBeenCalledWith('Bold and italic', '<em><strong>Bold and italic</strong></em>')
  })

  it('handles line breaks in formatted text', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    // Click bold button
    const boldButton = screen.getByTitle('Bold')
    fireEvent.click(boldButton)

    // Type text with line breaks
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2' } })

    expect(mockOnChange).toHaveBeenCalledWith('Line 1\nLine 2', '<strong>Line 1<br>Line 2</strong>')
  })
})
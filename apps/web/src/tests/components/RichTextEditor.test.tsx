import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'
import { typeInContentEditable, getContentEditableByPlaceholder } from '@/tests/utils/test-helpers'

// Mock document.execCommand for testing
Object.defineProperty(document, 'execCommand', {
  value: jest.fn(() => true),
  writable: true
})

describe('RichTextEditor', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    ;(document.execCommand as jest.Mock).mockClear()
  })

  it('renders basic text editor', () => {
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
        placeholder="Test placeholder"
      />
    )

    const editor = getContentEditableByPlaceholder(container, 'Test placeholder')
    expect(editor).toBeInTheDocument()
    expect(editor).toHaveAttribute('contenteditable', 'true')
  })

  it('calls onChange with plain text when no formatting is applied', () => {
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const editor = screen.getByRole('textbox')
    typeInContentEditable(editor, 'Hello world')

    expect(mockOnChange).toHaveBeenCalledWith('Hello world', 'Hello world')
  })

  it('calls execCommand when bold button is clicked', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const boldButton = screen.getByTitle('Bold')
    fireEvent.click(boldButton)

    expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined)
  })

  it('calls execCommand when italic button is clicked', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const italicButton = screen.getByTitle('Italic')
    fireEvent.click(italicButton)

    expect(document.execCommand).toHaveBeenCalledWith('italic', false, undefined)
  })

  it('calls execCommand when underline button is clicked', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const underlineButton = screen.getByTitle('Underline')
    fireEvent.click(underlineButton)

    expect(document.execCommand).toHaveBeenCalledWith('underline', false, undefined)
  })

  it('handles text input in contentEditable', () => {
    render(
      <RichTextEditor
        value=""
        onChange={mockOnChange}
      />
    )

    const editor = screen.getByRole('textbox')
    typeInContentEditable(editor, 'Test content')

    expect(mockOnChange).toHaveBeenCalled()
  })

  it('initializes with HTML value when provided', () => {
    const { container } = render(
      <RichTextEditor
        value=""
        htmlValue="<strong>Bold text</strong>"
        onChange={mockOnChange}
      />
    )

    const editor = screen.getByRole('textbox')
    expect(editor.innerHTML).toContain('Bold text')
  })
})
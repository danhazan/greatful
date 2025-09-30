import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
import RichContentRenderer from '@/components/RichContentRenderer'
import { PostStyle } from '@/components/PostStyleSelector'
import { extractPrimaryBackgroundColor, getTextColorForBackground } from '@/utils/colorUtils'

describe('RichContentRenderer', () => {
  const mockOnMentionClick = jest.fn()

  beforeEach(() => {
    mockOnMentionClick.mockClear()
  })

  it('renders plain content when no rich content or style provided', () => {
    render(
      <RichContentRenderer
        content="This is plain text content"
        onMentionClick={mockOnMentionClick}
      />
    )

    expect(screen.getByText('This is plain text content')).toBeInTheDocument()
  })

  it('renders content with markdown formatting', () => {
    const contentWithMarkdown = 'This is **bold** and *italic* text with __underline__'
    
    render(
      <RichContentRenderer
        content={contentWithMarkdown}
        onMentionClick={mockOnMentionClick}
      />
    )

    // Check that rich content is rendered with HTML formatting and block-level RTL support
    const container = screen.getByText('bold').closest('.rich-content-rendered')
    expect(container).toBeInTheDocument()
    expect(container?.innerHTML).toContain('<strong')
    expect(container?.innerHTML).toContain('bold</strong>')
    expect(container?.innerHTML).toContain('<em')
    expect(container?.innerHTML).toContain('italic</em>')
    expect(container?.innerHTML).toContain('<u')
    expect(container?.innerHTML).toContain('underline</u>')
    // Check that container has LTR direction
    expect(container).toHaveAttribute('dir', 'ltr')
  })

  it('applies post style correctly', () => {
    const postStyle: PostStyle = {
      id: 'test-style',
      name: 'Test Style',
      backgroundColor: '#f0f0f0',
      backgroundGradient: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
      textColor: '#333333',
      borderStyle: '2px solid #cccccc',
      fontFamily: 'Arial, sans-serif',
      textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
    }

    render(
      <RichContentRenderer
        content="Styled content"
        postStyle={postStyle}
        onMentionClick={mockOnMentionClick}
      />
    )

    // Compute expected color using colorUtils
    const primary = extractPrimaryBackgroundColor(postStyle.backgroundGradient || postStyle.backgroundColor);
    const expectedColor = postStyle.textColor && postStyle.textColor !== 'auto'
      ? postStyle.textColor
      : getTextColorForBackground(primary, '#374151');

    const styledContainer = screen.getByText('Styled content').closest('.rich-content')
    expect(styledContainer).toHaveStyle({
      backgroundColor: '#f0f0f0',
      background: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)',
      color: expectedColor,
      border: '2px solid #cccccc',
      fontFamily: 'Arial, sans-serif',
      textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
    })
  })

  it('handles mentions in plain content', () => {
    render(
      <RichContentRenderer
        content="Hello @john and @jane_doe"
        onMentionClick={mockOnMentionClick}
        validUsernames={['john', 'jane_doe']}
      />
    )

    const johnMention = screen.getByText('@john')
    const janeMention = screen.getByText('@jane_doe')

    expect(johnMention).toBeInTheDocument()
    expect(janeMention).toBeInTheDocument()

    fireEvent.click(johnMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('john')

    fireEvent.click(janeMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('jane_doe')
  })

  it('handles mentions in markdown content', () => {
    const contentWithMentions = 'Hello @alice with **bold** text'
    
    render(
      <RichContentRenderer
        content={contentWithMentions}
        onMentionClick={mockOnMentionClick}
        validUsernames={['alice']}
      />
    )

    const aliceMention = screen.getByText('@alice')
    expect(aliceMention).toBeInTheDocument()

    fireEvent.click(aliceMention)
    expect(mockOnMentionClick).toHaveBeenCalledWith('alice')
  })

  it('renders without onMentionClick handler', () => {
    render(
      <RichContentRenderer
        content="Hello @user without click handler"
      />
    )

    expect(screen.getByText('Hello @user without click handler')).toBeInTheDocument()
  })

  it('handles line breaks in content', () => {
    const contentWithLineBreaks = 'Line 1\nLine 2\nLine 3'
    
    const { container } = render(
      <RichContentRenderer
        content={contentWithLineBreaks}
      />
    )

    const contentDiv = container.querySelector('.rich-content-rendered')
    // With the new DOM parsing approach, line breaks are handled differently
    expect(contentDiv?.innerHTML).toContain('Line 1')
    expect(contentDiv?.innerHTML).toContain('Line 2')
    expect(contentDiv?.innerHTML).toContain('Line 3')
    // Check that container has LTR direction
    expect(contentDiv).toHaveAttribute('dir', 'ltr')
  })

  it('combines post style with markdown formatting', () => {
    const postStyle: PostStyle = {
      id: 'combined-style',
      name: 'Combined Style',
      backgroundColor: '#fff0f0',
      textColor: '#800000'
    }
    const contentWithMarkdown = 'This is **bold** text with style'

    render(
      <RichContentRenderer
        content={contentWithMarkdown}
        postStyle={postStyle}
        onMentionClick={mockOnMentionClick}
      />
    )

    // Compute expected color using colorUtils
    const primary = extractPrimaryBackgroundColor(postStyle.backgroundColor || 'transparent');
    const expectedColor = postStyle.textColor && postStyle.textColor !== 'auto'
      ? postStyle.textColor
      : getTextColorForBackground(primary, '#374151');

    const container = screen.getByText('bold').closest('.rich-content')
    expect(container).toHaveStyle({
      backgroundColor: '#fff0f0',
      color: expectedColor
    })
    
    const richContainer = container?.querySelector('.rich-content-rendered')
    expect(richContainer?.innerHTML).toContain('<strong')
    expect(richContainer?.innerHTML).toContain('bold</strong>')
    // Check that container has LTR direction
    expect(richContainer).toHaveAttribute('dir', 'ltr')
  })

  it('applies custom className', () => {
    render(
      <RichContentRenderer
        content="Content with custom class"
        className="custom-class"
      />
    )

    // The custom class is applied to the container, not the text element
    const container = screen.getByText('Content with custom class').closest('.rich-content-rendered')
    expect(container).toHaveClass('custom-class')
  })

  it('uses explicit textColor for elegant-dark style', () => {
    const elegantDarkStyle: PostStyle = {
      id: 'elegant-dark',
      name: 'Elegant Dark',
      backgroundColor: '#1a1a1a',
      textColor: '#ffffff'
    }

    render(
      <RichContentRenderer
        content="Dark theme content"
        postStyle={elegantDarkStyle}
        onMentionClick={mockOnMentionClick}
      />
    )

    // For elegant-dark, should use explicit textColor
    const expectedColor = elegantDarkStyle.textColor;

    const styledContainer = screen.getByText('Dark theme content').closest('.rich-content')
    expect(styledContainer).toHaveStyle({
      backgroundColor: '#1a1a1a',
      color: expectedColor
    })
  })
})
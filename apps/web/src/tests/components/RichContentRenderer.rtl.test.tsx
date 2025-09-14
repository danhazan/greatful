import React from 'react'
import { describe, it, expect } from '@jest/globals'
import { render } from '@testing-library/react'
import RichContentRenderer from '@/components/RichContentRenderer'

describe('RichContentRenderer RTL Support', () => {
  it('should apply RTL direction to Hebrew content with formatting', () => {
    const hebrewContent = "זה **עלי** בעברית"
    
    render(
      <RichContentRenderer
        content={hebrewContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Check that the rendered content has RTL direction
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'rtl')
    
    // Check that the content is properly formatted
    expect(renderedContent?.innerHTML).toContain('<strong>עלי</strong>')
  })

  it('should apply RTL attributes to HTML elements in Hebrew content', () => {
    const hebrewContent = "זה **עלי** בעברית"
    
    render(
      <RichContentRenderer
        content={hebrewContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Check that the rendered content has RTL direction
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'rtl')
    expect(renderedContent?.innerHTML).toContain('<strong>עלי</strong>')
  })

  it('should apply LTR direction to English content with formatting', () => {
    const englishContent = "This is **bold** text"
    
    render(
      <RichContentRenderer
        content={englishContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Check that the rendered content has LTR direction
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'ltr')
    expect(renderedContent?.innerHTML).toContain('<strong>bold</strong>')
  })

  it('should apply LTR attributes to HTML elements in English content', () => {
    const englishContent = "This is **bold** text"
    
    render(
      <RichContentRenderer
        content={englishContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Check that the rendered content has LTR direction
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'ltr')
    expect(renderedContent?.innerHTML).toContain('<strong>bold</strong>')
  })

  it('should handle mixed content with Hebrew and formatting', () => {
    const mixedContent = "Hello **שלום** world"
    
    render(
      <RichContentRenderer
        content={mixedContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Since the content contains Hebrew, it should be treated as RTL
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'rtl')
    expect(renderedContent?.innerHTML).toContain('<strong>שלום</strong>')
  })

  it('should handle plain Hebrew text without formatting', () => {
    const hebrewContent = "שלום עולם"
    
    render(
      <RichContentRenderer
        content={hebrewContent}
        onMentionClick={() => {}}
        validUsernames={[]}
      />
    )

    // Check that plain text gets RTL treatment
    const renderedContent = document.querySelector('.rich-content-rendered')
    expect(renderedContent).toHaveAttribute('dir', 'rtl')
    expect(renderedContent?.innerHTML).toContain('שלום עולם')
  })
})
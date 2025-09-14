import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'
import RichContentRenderer from '@/components/RichContentRenderer'

describe('RichContentRenderer RTL Fix', () => {
  it('should display Hebrew text correctly without reversal', () => {
    const hebrewText = 'עלי'
    
    render(<RichContentRenderer content={hebrewText} />)
    
    // The text should appear as-is, not reversed
    const element = screen.getByText(hebrewText)
    expect(element).toBeInTheDocument()
    
    // Container should have RTL direction
    const container = element.closest('[dir]')
    expect(container).toHaveAttribute('dir', 'rtl')
  })

  it('should display bold Hebrew text correctly without reversal', () => {
    const boldHebrewText = '**עלי**'
    const expectedText = 'עלי'
    
    render(<RichContentRenderer content={boldHebrewText} />)
    
    // Should find the Hebrew text inside a strong element
    const strongElement = screen.getByText(expectedText)
    expect(strongElement).toBeInTheDocument()
    expect(strongElement.tagName).toBe('STRONG')
    
    // Container should have RTL direction
    const container = strongElement.closest('[dir]')
    expect(container).toHaveAttribute('dir', 'rtl')
  })

  it('should display mixed Hebrew and English correctly', () => {
    const mixedText = 'Hello עלי world'
    
    render(<RichContentRenderer content={mixedText} />)
    
    const element = screen.getByText(mixedText)
    expect(element).toBeInTheDocument()
    
    // Mixed content should use RTL direction due to Hebrew presence
    const container = element.closest('[dir]')
    expect(container).toHaveAttribute('dir', 'rtl')
  })

  it('should display English text with LTR direction', () => {
    const englishText = 'Hello world'
    
    render(<RichContentRenderer content={englishText} />)
    
    const element = screen.getByText(englishText)
    expect(element).toBeInTheDocument()
    
    // English text should have LTR direction
    const container = element.closest('[dir]')
    expect(container).toHaveAttribute('dir', 'ltr')
  })

  it('should handle formatted mixed content correctly', () => {
    const formattedMixed = '**Hello** עלי *world*'
    
    render(<RichContentRenderer content={formattedMixed} />)
    
    // Should find both formatted elements
    const strongElement = screen.getByText('Hello')
    const emElement = screen.getByText('world')
    const hebrewText = screen.getByText('עלי')
    
    expect(strongElement.tagName).toBe('STRONG')
    expect(emElement.tagName).toBe('EM')
    expect(hebrewText).toBeInTheDocument()
    
    // Container should be RTL due to Hebrew content
    const container = hebrewText.closest('[dir]')
    expect(container).toHaveAttribute('dir', 'rtl')
  })
})
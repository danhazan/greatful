import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'

describe('RichTextEditor Z-Index Fix', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('removes overflow-hidden from toolbar to prevent stacking context issues', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const toolbar = document.querySelector('.toolbar')
    expect(toolbar).not.toHaveClass('overflow-hidden')
  })

  it('creates portal-based dropdowns with fixed positioning', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    fireEvent.click(textSizeButton)
    
    // Check for portal-rendered dropdown with fixed positioning
    const dropdown = document.querySelector('[data-rich-text-modal]')
    expect(dropdown).toBeInTheDocument()
    expect(dropdown).toHaveClass('fixed')
    expect(dropdown).toHaveClass('z-[9999]')
  })

  it('positions text size picker dropdown correctly', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    fireEvent.click(textSizeButton)
    
    // Should show text size options
    expect(screen.getByText('Small')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Large')).toBeInTheDocument()
    expect(screen.getByText('Extra Large')).toBeInTheDocument()
  })

  it('positions color picker dropdown correctly', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const colorButton = screen.getByTitle('Text Color')
    fireEvent.click(colorButton)
    
    // Should show color grid with portal positioning
    const dropdown = document.querySelector('[data-rich-text-modal]')
    expect(dropdown).toBeInTheDocument()
    expect(dropdown).toHaveClass('fixed')
    expect(dropdown).toHaveClass('z-[9999]')
    
    // Should have color grid
    const colorButtons = dropdown?.querySelectorAll('button')
    expect(colorButtons?.length).toBeGreaterThan(10) // Should have multiple color options
  })

  it('positions background picker dropdown correctly', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const backgroundButton = screen.getByTitle('Background Color')
    fireEvent.click(backgroundButton)
    
    // Should show background color grid with portal positioning
    const dropdown = document.querySelector('[data-rich-text-modal]')
    expect(dropdown).toBeInTheDocument()
    expect(dropdown).toHaveClass('fixed')
    expect(dropdown).toHaveClass('z-[9999]')
    
    // Should have background color grid
    const colorButtons = dropdown?.querySelectorAll('button')
    expect(colorButtons?.length).toBeGreaterThan(10) // Should have multiple background options
  })

  it('closes dropdowns when clicking outside', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    fireEvent.click(textSizeButton)
    
    // Dropdown should be visible
    expect(document.querySelector('[data-rich-text-modal]')).toBeInTheDocument()
    
    // Click outside (on the backdrop)
    const backdrop = document.querySelector('.fixed.inset-0.z-\\[9998\\]')
    if (backdrop) {
      fireEvent.click(backdrop)
    }
    
    // Dropdown should be closed
    expect(document.querySelector('[data-rich-text-modal]')).not.toBeInTheDocument()
  })

  it('maintains dropdown functionality after z-index fix', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    // Test text size picker functionality
    const textSizeButton = screen.getByTitle('Text Size')
    fireEvent.click(textSizeButton)
    
    const largeOption = screen.getByText('Large')
    fireEvent.click(largeOption)
    
    // Dropdown should close after selection
    expect(document.querySelector('[data-rich-text-modal]')).not.toBeInTheDocument()
    
    // Test color picker functionality
    const colorButton = screen.getByTitle('Text Color')
    fireEvent.click(colorButton)
    
    const dropdown = document.querySelector('[data-rich-text-modal]')
    expect(dropdown).toBeInTheDocument()
    
    // Click a color button
    const colorButtons = dropdown?.querySelectorAll('button')
    if (colorButtons && colorButtons.length > 0) {
      fireEvent.click(colorButtons[0])
    }
    
    // Dropdown should close after color selection
    expect(document.querySelector('[data-rich-text-modal]')).not.toBeInTheDocument()
  })

  it('ensures dropdowns appear above modal content with high z-index', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    fireEvent.click(textSizeButton)
    
    const dropdown = document.querySelector('[data-rich-text-modal]')
    expect(dropdown).toBeInTheDocument()
    
    // Should have high z-index to appear above modal content
    expect(dropdown).toHaveClass('z-[9999]')
    
    // Should use fixed positioning to escape stacking context
    expect(dropdown).toHaveClass('fixed')
    
    // Should have proper styling for visibility
    expect(dropdown).toHaveClass('bg-white')
    expect(dropdown).toHaveClass('shadow-lg')
  })
})
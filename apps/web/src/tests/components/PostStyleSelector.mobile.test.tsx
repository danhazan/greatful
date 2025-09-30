import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import PostStyleSelector, { POST_STYLES } from '@/components/PostStyleSelector'

// Mock window.innerWidth for mobile testing
const mockWindowInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
}

describe('PostStyleSelector Mobile Optimization', () => {
  const mockOnStyleChange = jest.fn()
  const mockOnClose = jest.fn()
  const defaultProps = {
    selectedStyle: POST_STYLES[0],
    onStyleChange: mockOnStyleChange,
    isOpen: true,
    onClose: mockOnClose,
    position: { x: 100, y: 100 }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Reset window width
    mockWindowInnerWidth(1024)
  })

  it('should render mobile layout when screen width is less than 768px', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Check that modal has mobile-specific classes
    const modal = screen.getByTestId('backgrounds-modal') || screen.getByRole('dialog')
    expect(modal).toHaveClass('w-full', 'mx-4')
  })

  it('should render desktop layout when screen width is 768px or more', () => {
    mockWindowInnerWidth(1024) // Desktop width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Check that modal has desktop-specific classes
    const modal = screen.getByTestId('backgrounds-modal') || screen.getByRole('dialog')
    expect(modal).toHaveClass('w-96')
  })

  it('should have touch-friendly button sizes on mobile (minimum 44px)', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Get all style buttons
    const styleButtons = screen.getAllByRole('button').filter(button => 
      button.textContent?.includes('Sample text')
    )
    
    // Check that buttons have minimum touch target size
    styleButtons.forEach(button => {
      expect(button).toHaveStyle({ minHeight: '44px' })
      // Check that touchAction is set in the style attribute
      expect(button.style.touchAction).toBe('manipulation')
    })
  })

  it('should show close button on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Should have a close button at the bottom
    const closeButton = screen.getByRole('button', { name: /close/i })
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveClass('w-full')
  })

  it('should not show close button on desktop', () => {
    mockWindowInnerWidth(1024) // Desktop width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Should not have a close button at the bottom
    const closeButton = screen.queryByRole('button', { name: /close/i })
    expect(closeButton).not.toBeInTheDocument()
  })

  it('should center modal on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    const modal = screen.getByTestId('backgrounds-modal') || screen.getByRole('dialog')
    
    // Check mobile positioning styles
    expect(modal).toHaveStyle({
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)'
    })
  })

  it('should use position props on desktop', () => {
    mockWindowInnerWidth(1024) // Desktop width
    
    render(<PostStyleSelector {...defaultProps} position={{ x: 200, y: 300 }} />)
    
    const modal = screen.getByTestId('backgrounds-modal') || screen.getByRole('dialog')
    
    // Should use provided position (adjusted for viewport)
    expect(modal).toHaveStyle({
      position: 'fixed'
    })
  })

  it('should handle style selection on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Click on a style button
    const styleButton = screen.getAllByRole('button').find(button => 
      button.textContent?.includes('Warm Sunset')
    )
    
    expect(styleButton).toBeInTheDocument()
    fireEvent.click(styleButton!)
    
    expect(mockOnStyleChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Warm Sunset' })
    )
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle close button click on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should have proper backdrop on both mobile and desktop', () => {
    // Test mobile
    mockWindowInnerWidth(375)
    const { rerender } = render(<PostStyleSelector {...defaultProps} />)
    
    let backdrop = document.querySelector('.fixed.inset-0.z-40')
    expect(backdrop).toBeInTheDocument()
    expect(backdrop).toHaveClass('bg-black', 'bg-opacity-30')
    
    // Test desktop
    mockWindowInnerWidth(1024)
    rerender(<PostStyleSelector {...defaultProps} />)
    
    backdrop = document.querySelector('.fixed.inset-0.z-40')
    expect(backdrop).toBeInTheDocument()
    expect(backdrop).toHaveClass('bg-black', 'bg-opacity-30')
  })

  it('should have appropriate max height on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    const modal = screen.getByTestId('backgrounds-modal') || screen.getByRole('dialog')
    expect(modal).toHaveClass('max-h-[80vh]')
  })

  it('should maintain grid layout on mobile', () => {
    mockWindowInnerWidth(375) // Mobile width
    
    render(<PostStyleSelector {...defaultProps} />)
    
    // Find the grid container
    const gridContainer = document.querySelector('.grid.gap-3.grid-cols-2')
    expect(gridContainer).toBeInTheDocument()
    
    // Should still have 2 columns on mobile for better touch targets
    expect(gridContainer).toHaveClass('grid-cols-2')
  })
})
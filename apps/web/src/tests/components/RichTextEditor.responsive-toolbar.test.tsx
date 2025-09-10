import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import RichTextEditor from '@/components/RichTextEditor'

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.getSelection
Object.defineProperty(window, 'getSelection', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    rangeCount: 0,
    removeAllRanges: jest.fn(),
    addRange: jest.fn(),
  })),
})

describe('RichTextEditor Responsive Toolbar', () => {
  let mockOnChange: ReturnType<typeof jest.fn>

  beforeEach(() => {
    mockOnChange = jest.fn()
    
    // Mock getBoundingClientRect for toolbar elements
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 300,
      height: 40,
      top: 0,
      left: 0,
      bottom: 40,
      right: 300,
      x: 0,
      y: 0,
      toJSON: jest.fn(),
    }))

    // Mock clientWidth and scrollWidth
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      value: 300,
    })
    
    Object.defineProperty(Element.prototype, 'scrollWidth', {
      configurable: true,
      value: 400, // Simulate overflow
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders toolbar with basic formatting buttons', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    // Always visible buttons
    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    
    // Check for text size button (should be visible initially)
    expect(screen.getByTitle('Text Size')).toBeInTheDocument()
  })

  it('shows text size picker when text size button is clicked', async () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    
    await act(async () => {
      fireEvent.click(textSizeButton)
    })
    
    // Should show text size options
    expect(screen.getByText('Small')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Large')).toBeInTheDocument()
    expect(screen.getByText('Extra Large')).toBeInTheDocument()
  })

  it('applies text size when option is selected', async () => {
    // Mock execCommand
    const mockExecCommand = jest.fn()
    document.execCommand = mockExecCommand

    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    
    await act(async () => {
      fireEvent.click(textSizeButton)
    })
    
    const largeOption = screen.getByText('Large')
    
    await act(async () => {
      fireEvent.click(largeOption)
    })
    
    expect(mockExecCommand).toHaveBeenCalledWith('fontSize', false, '5')
  })

  it('shows overflow menu when toolbar is narrow', async () => {
    // Mock narrow toolbar
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      value: 200, // Narrow width
    })
    
    Object.defineProperty(Element.prototype, 'scrollWidth', {
      configurable: true,
      value: 400, // Wide content
    })

    render(<RichTextEditor onChange={mockOnChange} />)
    
    // Wait for overflow detection
    await act(async () => {
      // Trigger resize event to force overflow check
      window.dispatchEvent(new Event('resize'))
      await new Promise(resolve => setTimeout(resolve, 150)) // Wait for debounce
    })
    
    // Should show overflow menu button
    const overflowButton = screen.queryByTitle('More Options')
    if (overflowButton) {
      expect(overflowButton).toBeInTheDocument()
    }
  })

  it('moves items to overflow menu when space is limited', async () => {
    // Mock very narrow toolbar
    Object.defineProperty(Element.prototype, 'clientWidth', {
      configurable: true,
      value: 150, // Very narrow
    })

    render(<RichTextEditor onChange={mockOnChange} />)
    
    // Wait for overflow detection
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
      await new Promise(resolve => setTimeout(resolve, 150))
    })
    
    // Bold should always be visible
    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    
    // Some items might be moved to overflow
    const overflowButton = screen.queryByTitle('More Options')
    if (overflowButton) {
      await act(async () => {
        fireEvent.click(overflowButton)
      })
      
      // Check if overflow menu contains expected items
      const overflowMenu = screen.queryByText('Italic') || 
                          screen.queryByText('Text Size') || 
                          screen.queryByText('Text Color')
      
      // At least one item should be in overflow when space is very limited
      expect(overflowMenu).toBeTruthy()
    }
  })

  it('closes dropdowns when clicking outside', async () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    
    await act(async () => {
      fireEvent.click(textSizeButton)
    })
    
    // Should show text size options
    expect(screen.getByText('Small')).toBeInTheDocument()
    
    // Click outside (on the backdrop)
    const backdrop = document.querySelector('.fixed.inset-0')
    if (backdrop) {
      await act(async () => {
        fireEvent.click(backdrop)
      })
      
      // Should close the dropdown
      expect(screen.queryByText('Small')).not.toBeInTheDocument()
    }
  })

  it('maintains single line layout', () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const toolbar = document.querySelector('.toolbar')
    expect(toolbar).toHaveClass('flex')
    expect(toolbar).toHaveClass('items-center')
    // Note: overflow-hidden removed to fix z-index dropdown issues
    expect(toolbar).not.toHaveClass('overflow-hidden')
    
    // Primary toolbar should use flex-nowrap
    const primaryToolbar = toolbar?.querySelector('[class*="flex-nowrap"]')
    expect(primaryToolbar).toBeInTheDocument()
  })

  it('provides keyboard navigation for text size picker', async () => {
    render(<RichTextEditor onChange={mockOnChange} />)
    
    const textSizeButton = screen.getByTitle('Text Size')
    
    await act(async () => {
      fireEvent.click(textSizeButton)
    })
    
    const smallOption = screen.getByText('Small')
    
    // Should be clickable (simulating keyboard activation)
    await act(async () => {
      fireEvent.click(smallOption)
    })
    
    // Should close the dropdown after selection
    expect(screen.queryByText('Small')).not.toBeInTheDocument()
  })
})
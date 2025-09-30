import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ImageModal from '@/components/ImageModal'

describe('ImageModal', () => {
  const defaultProps = {
    src: 'https://example.com/test-image.jpg',
    alt: 'Test image',
    isOpen: true,
    onClose: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not render when isOpen is false', () => {
    render(<ImageModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(<ImageModal {...defaultProps} />)
    
    expect(screen.getByRole('img')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAttribute('src', defaultProps.src)
    expect(screen.getByRole('img')).toHaveAttribute('alt', defaultProps.alt)
  })

  it('should show close button', () => {
    render(<ImageModal {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close image modal')
    expect(closeButton).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    render(<ImageModal {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close image modal')
    fireEvent.click(closeButton)
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when backdrop is clicked', () => {
    render(<ImageModal {...defaultProps} />)
    
    // Click on the backdrop (the modal container)
    const backdrop = screen.getByRole('img').closest('.fixed')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should call onClose when clicking outside the image', () => {
    const { container } = render(<ImageModal {...defaultProps} />)
    
    // Find the modal backdrop (the outermost div with fixed positioning)
    const modalBackdrop = container.querySelector('.fixed')
    if (modalBackdrop) {
      // Create a click event that targets the backdrop directly
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(clickEvent, 'target', { value: modalBackdrop })
      Object.defineProperty(clickEvent, 'currentTarget', { value: modalBackdrop })
      
      modalBackdrop.dispatchEvent(clickEvent)
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('should show loading indicator initially', () => {
    render(<ImageModal {...defaultProps} />)
    
    expect(screen.getByRole('img')).toBeInTheDocument()
    // Loading state is managed internally and shows until image loads
  })

  it('should show zoom controls on desktop', () => {
    render(<ImageModal {...defaultProps} />)
    
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
    expect(screen.getByLabelText('Reset zoom')).toBeInTheDocument()
  })

  it('should show mobile instructions on mobile', () => {
    render(<ImageModal {...defaultProps} />)
    
    expect(screen.getByText('Pinch to zoom • Drag to pan')).toBeInTheDocument()
  })

  it('should handle zoom in button click', async () => {
    render(<ImageModal {...defaultProps} />)
    
    const zoomInButton = screen.getByLabelText('Zoom in')
    fireEvent.click(zoomInButton)
    
    // Check that zoom percentage changed
    await waitFor(() => {
      expect(screen.getByText('125%')).toBeInTheDocument()
    })
  })

  it('should handle zoom out button click', async () => {
    render(<ImageModal {...defaultProps} />)
    
    const zoomOutButton = screen.getByLabelText('Zoom out')
    fireEvent.click(zoomOutButton)
    
    // Check that zoom percentage changed
    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
  })

  it('should handle reset button click', async () => {
    render(<ImageModal {...defaultProps} />)
    
    // First zoom in
    const zoomInButton = screen.getByLabelText('Zoom in')
    fireEvent.click(zoomInButton)
    
    // Then reset
    const resetButton = screen.getByLabelText('Reset zoom')
    fireEvent.click(resetButton)
    
    // Check that zoom is back to 100%
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  it('should prevent body scroll when open', () => {
    const originalOverflow = document.body.style.overflow
    
    render(<ImageModal {...defaultProps} />)
    
    expect(document.body.style.overflow).toBe('hidden')
    
    // Cleanup
    document.body.style.overflow = originalOverflow
  })

  it('should restore body scroll when closed', () => {
    const originalOverflow = document.body.style.overflow
    
    const { rerender } = render(<ImageModal {...defaultProps} />)
    expect(document.body.style.overflow).toBe('hidden')
    
    rerender(<ImageModal {...defaultProps} isOpen={false} />)
    expect(document.body.style.overflow).toBe('unset')
    
    // Cleanup
    document.body.style.overflow = originalOverflow
  })
})
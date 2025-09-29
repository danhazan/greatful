import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import OptimizedPostImage from '@/components/OptimizedPostImage'

// Mock IntersectionObserver for tests
const mockIntersectionObserver = jest.fn()
const mockObserve = jest.fn()
const mockDisconnect = jest.fn()

mockIntersectionObserver.mockImplementation((callback) => ({
  observe: mockObserve,
  unobserve: jest.fn(),
  disconnect: mockDisconnect,
  callback
}))

// Make IntersectionObserver undefined to trigger test mode in component
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: undefined
})

describe('OptimizedPostImage', () => {
  const defaultProps = {
    src: 'https://example.com/test-image.jpg',
    alt: 'Test image',
    postType: 'daily' as const
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render loading state initially', () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    expect(screen.getByText('Loading image...')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('should render image after loading', async () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    
    // Simulate image load
    Object.defineProperty(img, 'naturalWidth', { value: 800 })
    Object.defineProperty(img, 'naturalHeight', { value: 600 })
    fireEvent.load(img)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading image...')).not.toBeInTheDocument()
    })
    
    expect(img).toHaveAttribute('src', defaultProps.src)
    expect(img).toHaveAttribute('alt', defaultProps.alt)
  })

  it('should show error state when image fails to load', async () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    fireEvent.error(img)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load image')).toBeInTheDocument()
    })
  })

  it('should apply correct container classes for daily post type', () => {
    const { container } = render(
      <OptimizedPostImage {...defaultProps} postType="daily" />
    )
    
    const imageContainer = container.firstChild as HTMLElement
    expect(imageContainer).toHaveClass('w-full', 'mt-4')
  })

  it('should apply correct container classes for photo post type', () => {
    const { container } = render(
      <OptimizedPostImage {...defaultProps} postType="photo" />
    )
    
    const imageContainer = container.firstChild as HTMLElement
    expect(imageContainer).toHaveClass('w-full', 'mt-4')
  })

  it('should apply correct container classes for spontaneous post type', () => {
    const { container } = render(
      <OptimizedPostImage {...defaultProps} postType="spontaneous" />
    )
    
    const imageContainer = container.firstChild as HTMLElement
    expect(imageContainer).toHaveClass('w-full', 'mt-3')
  })

  it('should use object-cover for all images to fill container', async () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    
    // Simulate image load
    Object.defineProperty(img, 'naturalWidth', { value: 1000 })
    Object.defineProperty(img, 'naturalHeight', { value: 300 })
    fireEvent.load(img)
    
    await waitFor(() => {
      expect(img).toHaveClass('object-cover')
      expect(img).toHaveClass('w-full')
      expect(img).toHaveClass('h-full')
    })
  })

  it('should apply full width and height classes to images', async () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    
    // Simulate image load
    Object.defineProperty(img, 'naturalWidth', { value: 800 })
    Object.defineProperty(img, 'naturalHeight', { value: 600 })
    fireEvent.load(img)
    
    await waitFor(() => {
      expect(img).toHaveClass('w-full')
      expect(img).toHaveClass('h-full')
      expect(img).toHaveClass('object-cover')
    })
  })

  it('should apply custom className when provided', () => {
    const customClass = 'custom-image-class'
    const { container } = render(
      <OptimizedPostImage {...defaultProps} className={customClass} />
    )
    
    const imageContainer = container.firstChild as HTMLElement
    expect(imageContainer).toHaveClass(customClass)
  })

  it('should have lazy loading attribute', () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('should load image successfully without overlay', async () => {
    render(<OptimizedPostImage {...defaultProps} />)
    
    const img = screen.getByRole('img', { hidden: true })
    
    // Simulate image load
    Object.defineProperty(img, 'naturalWidth', { value: 800 })
    Object.defineProperty(img, 'naturalHeight', { value: 600 })
    fireEvent.load(img)
    
    await waitFor(() => {
      expect(screen.queryByText('Loading image...')).not.toBeInTheDocument()
      expect(img).toHaveClass('opacity-100')
    })
  })

  it('should apply aspect ratio styles based on image dimensions', async () => {
    const { container } = render(
      <OptimizedPostImage {...defaultProps} postType="daily" />
    )
    
    const img = screen.getByRole('img', { hidden: true })
    
    // Simulate wide image (2:1 aspect ratio)
    Object.defineProperty(img, 'naturalWidth', { value: 1000, configurable: true })
    Object.defineProperty(img, 'naturalHeight', { value: 500, configurable: true })
    fireEvent.load(img)
    
    await waitFor(() => {
      const imageContainer = container.firstChild as HTMLElement
      expect(imageContainer.style.aspectRatio).toBeTruthy()
    })
  })

  it('should set default aspect ratio while loading', () => {
    const { container } = render(
      <OptimizedPostImage {...defaultProps} />
    )
    
    const imageContainer = container.firstChild as HTMLElement
    expect(imageContainer.style.aspectRatio).toBe('16 / 9')
  })
})
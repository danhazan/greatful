import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import StackedImagePreview from '@/components/StackedImagePreview'

// Mock IntersectionObserver properly
beforeAll(() => {
  const mockObserverCallback = jest.fn()

  class MockIntersectionObserver {
    callback: IntersectionObserverCallback
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback
      mockObserverCallback(callback)
    }
    observe(target: Element) {
      // Immediately trigger as visible
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      )
    }
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  })
})

describe('StackedImagePreview', () => {
  const mockImages = [
    {
      id: 'img-1',
      position: 0,
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      mediumUrl: 'https://example.com/medium1.jpg',
      originalUrl: 'https://example.com/original1.jpg',
      width: 800,
      height: 600
    },
    {
      id: 'img-2',
      position: 1,
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      mediumUrl: 'https://example.com/medium2.jpg',
      originalUrl: 'https://example.com/original2.jpg',
      width: 1200,
      height: 900
    },
    {
      id: 'img-3',
      position: 2,
      thumbnailUrl: 'https://example.com/thumb3.jpg',
      mediumUrl: 'https://example.com/medium3.jpg',
      originalUrl: 'https://example.com/original3.jpg',
      width: 1600,
      height: 1200
    }
  ]

  const mockOnImageClick = jest.fn()

  beforeEach(() => {
    mockOnImageClick.mockClear()
  })

  it('renders the component with correct accessibility', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Check that the component renders with proper role
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('has correct aria-label for single image', () => {
    render(
      <StackedImagePreview
        images={[mockImages[0]]}
        onImageClick={mockOnImageClick}
      />
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'View 1 image')
  })

  it('has correct aria-label for multiple images', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'View 3 images')
  })

  it('shows loading state initially', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Loading spinner should be visible initially
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders the primary image', async () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Image should be rendered
    const img = screen.getByAltText('Post image')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', mockImages[0].mediumUrl)
  })

  it('calls onImageClick when clicked after loading', async () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Simulate image load
    const img = screen.getByAltText('Post image')
    fireEvent.load(img)

    // Click the preview
    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(mockOnImageClick).toHaveBeenCalledWith(0)
  })

  it('handles keyboard navigation with Enter', async () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Simulate image load
    const img = screen.getByAltText('Post image')
    fireEvent.load(img)

    // Press Enter on the button
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(mockOnImageClick).toHaveBeenCalledWith(0)
  })

  it('handles keyboard navigation with Space', async () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Simulate image load
    const img = screen.getByAltText('Post image')
    fireEvent.load(img)

    // Press Space on the button
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: ' ' })

    expect(mockOnImageClick).toHaveBeenCalledWith(0)
  })

  it('displays images sorted by position', () => {
    const unsortedImages = [
      { ...mockImages[2], position: 2 },
      { ...mockImages[0], position: 0 },
      { ...mockImages[1], position: 1 }
    ]

    render(
      <StackedImagePreview
        images={unsortedImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Primary image should be the one with position 0
    const img = screen.getByAltText('Post image')
    expect(img).toHaveAttribute('src', mockImages[0].mediumUrl)
  })

  it('handles error state when image fails to load', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Simulate image error
    const img = screen.getByAltText('Post image')
    fireEvent.error(img)

    // Error message should appear
    expect(screen.getByText('Failed to load image')).toBeInTheDocument()
  })

  it('does not call onImageClick when image failed to load', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
      />
    )

    // Simulate image error
    const img = screen.getByAltText('Post image')
    fireEvent.error(img)

    // Click should not trigger the callback when in error state
    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(mockOnImageClick).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(
      <StackedImagePreview
        images={mockImages}
        onImageClick={mockOnImageClick}
        className="custom-class"
      />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })
})

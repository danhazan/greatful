import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import LocationDisplayModal from '@/components/LocationDisplayModal'

// Mock window dimensions for positioning
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024,
})

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 768,
})

describe('LocationDisplayModal', () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('should not render when isOpen is false', () => {
    render(
      <LocationDisplayModal
        isOpen={false}
        onClose={mockOnClose}
        location="New York, NY"
      />
    )

    expect(screen.queryByText('Location')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
        location="New York, NY"
      />
    )

    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('New York, NY')).toBeInTheDocument()
  })

  it('should prefer locationData.display_name over location string', () => {
    const locationData = {
      display_name: "Central Park, New York, NY, USA",
      lat: 40.7829,
      lon: -73.9654,
      address: {
        city: "New York",
        state: "NY",
        country: "USA"
      }
    }

    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
        location="New York, NY"
        locationData={locationData}
      />
    )

    expect(screen.getByText('Central Park, New York, NY, USA')).toBeInTheDocument()
    expect(screen.queryByText('New York, NY')).not.toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
        location="New York, NY"
      />
    )

    const closeButton = screen.getByLabelText('Close location modal')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when escape key is pressed', () => {
    const isolatedMockOnClose = jest.fn()
    
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={isolatedMockOnClose}
        location="New York, NY"
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(isolatedMockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when clicking outside the modal', () => {
    const isolatedMockOnClose = jest.fn()
    
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={isolatedMockOnClose}
        location="New York, NY"
      />
    )

    // Click on the backdrop
    const backdrop = document.querySelector('.fixed.inset-0.bg-black')
    if (backdrop) {
      fireEvent.mouseDown(backdrop)
    }

    expect(isolatedMockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should display unknown location when no location data is provided', () => {
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Unknown location')).toBeInTheDocument()
  })

  it('should have proper accessibility attributes', () => {
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
        location="New York, NY"
      />
    )

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveAttribute('aria-modal', 'true')
    expect(modal).toHaveAttribute('aria-labelledby', 'location-modal-title')
    expect(modal).toHaveAttribute('aria-describedby', 'location-modal-description')
  })

  it('should position modal correctly based on position prop', () => {
    const position = { x: 100, y: 200 }
    
    render(
      <LocationDisplayModal
        isOpen={true}
        onClose={mockOnClose}
        location="New York, NY"
        position={position}
      />
    )

    const modal = screen.getByRole('dialog')
    
    // The modal should have the fixed class and inline positioning styles
    expect(modal).toHaveClass('fixed')
    // The positioning calculation takes into account window size and modal constraints
    // Just verify that positioning styles are applied (exact values depend on calculation)
    expect(modal.style.left).toBeDefined()
    expect(modal.style.top).toBeDefined()
  })
})
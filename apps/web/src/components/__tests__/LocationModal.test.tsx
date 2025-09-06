import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LocationModal from '../LocationModal'

// Mock LocationAutocomplete component
jest.mock('../LocationAutocomplete', () => {
  return function MockLocationAutocomplete({ 
    value, 
    onChange, 
    onLocationSelect, 
    placeholder 
  }: any) {
    return (
      <div>
        <input
          data-testid="location-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          data-testid="select-location"
          onClick={() => onLocationSelect({
            display_name: "Test Location",
            lat: 40.7128,
            lon: -74.0060,
            address: { city: "New York", country: "USA" }
          })}
        >
          Select Test Location
        </button>
      </div>
    )
  }
})

describe('LocationModal', () => {
  const mockOnClose = jest.fn()
  const mockOnLocationSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders when open', () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue=""
      />
    )

    expect(screen.getByText('Add Location')).toBeInTheDocument()
    expect(screen.getByText('Search for a location')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <LocationModal
        isOpen={false}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue=""
      />
    )

    expect(screen.queryByText('Add Location')).not.toBeInTheDocument()
  })

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue=""
      />
    )

    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('calls onLocationSelect and onClose when location is selected', async () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue=""
      />
    )

    fireEvent.click(screen.getByTestId('select-location'))

    await waitFor(() => {
      expect(mockOnLocationSelect).toHaveBeenCalledWith({
        display_name: "Test Location",
        lat: 40.7128,
        lon: -74.0060,
        address: { city: "New York", country: "USA" }
      })
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  it('calls onLocationSelect and onClose when Clear Location is clicked', () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue="Some Location"
      />
    )

    fireEvent.click(screen.getByText('Clear Location'))

    expect(mockOnLocationSelect).toHaveBeenCalledWith(null)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('shows initial value when provided', () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue="New York, NY"
      />
    )

    expect(screen.getByText('✓ Current: New York, NY')).toBeInTheDocument()
  })

  it('prevents event bubbling when clicking inside modal', () => {
    const mockBackdropClick = jest.fn()
    
    render(
      <div onClick={mockBackdropClick}>
        <LocationModal
          isOpen={true}
          onClose={mockOnClose}
          onLocationSelect={mockOnLocationSelect}
          initialValue=""
        />
      </div>
    )

    // Click inside the modal content
    fireEvent.click(screen.getByText('Add Location'))
    
    // The backdrop click handler should not be called
    expect(mockBackdropClick).not.toHaveBeenCalled()
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('has data-location-modal attribute for parent modal detection', () => {
    render(
      <LocationModal
        isOpen={true}
        onClose={mockOnClose}
        onLocationSelect={mockOnLocationSelect}
        initialValue=""
      />
    )

    // Check that the modal container has the data attribute
    const modalContainer = document.querySelector('[data-location-modal]')
    expect(modalContainer).toBeInTheDocument()
    expect(modalContainer).toHaveClass('fixed', 'inset-0')
  })
})
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CreatePostModal from '../CreatePostModal'
import { ToastProvider } from '@/contexts/ToastContext'

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

// Mock MentionAutocomplete component
jest.mock('../MentionAutocomplete', () => {
  return function MockMentionAutocomplete() {
    return <div data-mention-autocomplete>Mention Autocomplete</div>
  }
})

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

describe('CreatePostModal - LocationModal Integration', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not close CreatePostModal when clicking inside LocationModal', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    // Open the location modal by clicking the button in CreatePostModal
    const addLocationButton = screen.getByRole('button', { name: /add location/i })
    fireEvent.click(addLocationButton)

    // Wait for location modal to appear
    await waitFor(() => {
      expect(screen.getByText('Search for a location')).toBeInTheDocument()
    })

    // Click inside the location modal content
    fireEvent.mouseDown(screen.getByText('Search for a location'))

    // CreatePostModal should NOT close
    expect(mockOnClose).not.toHaveBeenCalled()

    // The location modal should still be open
    expect(screen.getByText('Search for a location')).toBeInTheDocument()
  })

  it('closes CreatePostModal when clicking outside both modals', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    // Click outside the modal (on document body)
    fireEvent.mouseDown(document.body)

    // CreatePostModal should close
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('allows location selection without closing CreatePostModal', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    // Open the location modal
    const addLocationButton = screen.getByRole('button', { name: /add location/i })
    fireEvent.click(addLocationButton)

    // Select a location
    fireEvent.click(screen.getByTestId('select-location'))

    // Wait for location to be selected and modal to close
    await waitFor(() => {
      expect(screen.queryByText('Search for a location')).not.toBeInTheDocument()
    })

    // CreatePostModal should still be open (not closed)
    expect(mockOnClose).not.toHaveBeenCalled()
    expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()

    // Location should be displayed in the post modal
    expect(screen.getByText('Test Location')).toBeInTheDocument()
  })

  it('has proper data attributes for modal detection', () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    // Open the location modal
    const addLocationButton = screen.getByRole('button', { name: /add location/i })
    fireEvent.click(addLocationButton)

    // Check that location modal has the data attribute
    const locationModal = document.querySelector('[data-location-modal]')
    expect(locationModal).toBeInTheDocument()
  })
})
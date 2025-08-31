import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import LocationAutocomplete from '@/components/LocationAutocomplete'

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('LocationAutocomplete', () => {
  const mockOnChange = jest.fn()
  const mockOnLocationSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue('mock-token')
  })

  it('renders input field with placeholder', () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
        placeholder="Enter location..."
      />
    )

    expect(screen.getByPlaceholderText('Enter location...')).toBeInTheDocument()
  })

  it('calls onChange when input value changes', () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New York' } })

    expect(mockOnChange).toHaveBeenCalledWith('New York')
  })

  it('shows loading state when searching', async () => {
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      }), 100))
    )

    render(
      <LocationAutocomplete
        value="New"
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New York' } })

    // Wait for debounce and loading state
    await waitFor(() => {
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    }, { timeout: 500 })
  })

  it('displays search results when available', async () => {
    const mockResults = [
      {
        display_name: 'New York, NY, USA',
        lat: 40.7128,
        lon: -74.0060,
        place_id: '123',
        address: {
          city: 'New York',
          state: 'NY',
          country: 'USA'
        }
      }
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockResults })
    })

    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New York' } })

    await waitFor(() => {
      expect(screen.getAllByText('New York, NY, USA')).toHaveLength(2) // display_name and address
    })
  })

  it('calls onLocationSelect when result is clicked', async () => {
    const mockResult = {
      display_name: 'New York, NY, USA',
      lat: 40.7128,
      lon: -74.0060,
      place_id: '123',
      address: {
        city: 'New York',
        state: 'NY',
        country: 'USA'
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [mockResult] })
    })

    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New York' } })

    await waitFor(() => {
      expect(screen.getAllByText('New York, NY, USA')).toHaveLength(2)
    })

    // Click the button containing the result
    const resultButton = screen.getByRole('button', { name: /new york/i })
    fireEvent.click(resultButton)

    expect(mockOnLocationSelect).toHaveBeenCalledWith(mockResult)
    expect(mockOnChange).toHaveBeenCalledWith('New York, NY, USA')
  })

  it('shows clear button when value is present', () => {
    render(
      <LocationAutocomplete
        value="New York"
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('clears value when clear button is clicked', () => {
    render(
      <LocationAutocomplete
        value="New York"
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /clear/i }))

    expect(mockOnChange).toHaveBeenCalledWith('')
    expect(mockOnLocationSelect).toHaveBeenCalledWith(null)
  })

  it('handles keyboard navigation', async () => {
    const mockResults = [
      {
        display_name: 'New York, NY, USA',
        lat: 40.7128,
        lon: -74.0060,
        place_id: '123',
        address: { city: 'New York', state: 'NY', country: 'USA' }
      },
      {
        display_name: 'New Orleans, LA, USA',
        lat: 29.9511,
        lon: -90.0715,
        place_id: '456',
        address: { city: 'New Orleans', state: 'LA', country: 'USA' }
      }
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockResults })
    })

    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New' } })

    await waitFor(() => {
      expect(screen.getAllByText('New York, NY, USA')).toHaveLength(2)
    })

    // Test arrow down navigation
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockOnLocationSelect).toHaveBeenCalledWith(mockResults[0])
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'New York' } })

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('does not search for queries less than 2 characters', () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'N' } })

    // Should not make API call
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('is disabled when disabled prop is true', () => {
    render(
      <LocationAutocomplete
        value=""
        onChange={mockOnChange}
        onLocationSelect={mockOnLocationSelect}
        disabled={true}
      />
    )

    const input = screen.getByRole('textbox')
    expect(input).toBeDisabled()
  })
})
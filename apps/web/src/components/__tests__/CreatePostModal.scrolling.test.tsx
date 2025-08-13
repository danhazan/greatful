import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CreatePostModal from '../CreatePostModal'
import { it } from 'node:test'
import { it } from 'node:test'
import { it } from 'node:test'
import { beforeEach } from 'node:test'
import { describe } from 'node:test'

// Mock the image upload utilities
jest.mock('@/utils/imageUpload', () => ({
  validateImageFile: jest.fn(() => ({ valid: true })),
  createImagePreview: jest.fn(() => 'blob:mock-url'),
  revokeImagePreview: jest.fn(),
}))

describe('CreatePostModal Scrolling', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should have scrollable content area', () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Check that the modal has proper structure for scrolling
    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    
    // Check for scrollable content area
    const scrollableArea = document.querySelector('.overflow-y-auto')
    expect(scrollableArea).toBeInTheDocument()
  })

  it('should always show the Share Gratitude button', () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    const submitButton = screen.getByText('Share Gratitude')
    expect(submitButton).toBeInTheDocument()
    expect(submitButton).toBeVisible()
  })

  it('should have proper modal height constraints', () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // The modal should have max-height constraint
    const modalContainer = document.querySelector('.max-h-\\[90vh\\]')
    expect(modalContainer).toBeInTheDocument()
  })
})
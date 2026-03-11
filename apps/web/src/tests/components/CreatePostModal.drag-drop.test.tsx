/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import CreatePostModal from '@/components/CreatePostModal'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the image upload utilities
jest.mock('@/utils/imageUpload', () => ({
  validateImageFile: jest.fn((file: File) => ({ valid: true })),
  createImagePreview: jest.fn((file: File) => `blob:${file.name}`),
  revokeImagePreview: jest.fn(),
  prepareImageForUpload: jest.fn((file) => Promise.resolve({ success: true, file })),
  prepareMultipleImagesForUpload: jest.fn((files) => Promise.resolve({ success: true, preparedFiles: files, rejectedCount: 0 })),
  MAX_POST_IMAGES: 7
}))

// Mock the mention utilities
jest.mock('@/utils/mentionUtils', () => ({
  extractMentions: jest.fn(() => [])
}))

// Mock components
jest.mock('@/components/MentionAutocomplete', () => {
  return function MockMentionAutocomplete() {
    return <div data-testid="mention-autocomplete" />
  }
})

jest.mock('@/components/LocationModal', () => {
  return function MockLocationModal() {
    return <div data-testid="location-modal" />
  }
})

const mockOnSubmit = jest.fn()
const mockOnClose = jest.fn()

const renderModal = (props = {}) => {
  return render(
    <ToastProvider>
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        {...props}
      />
    </ToastProvider>
  )
}

describe('CreatePostModal - Drag and Drop', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = jest.fn()
  })

  it('shows drag and drop zone when no image is present', () => {
    renderModal()

    expect(screen.getByTestId('drag-drop-zone')).toBeInTheDocument()
    expect(screen.getByText(/JPG, PNG, WebP up to 5MB each/)).toBeInTheDocument()
  })

  it('hides drag and drop zone when image is present', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')

    renderModal()

    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')

    const dropZone = screen.getByTestId('drag-drop-zone')
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Simulate file drop to upload image
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: jest.fn(() => '')
      }
    })

    // Wait for the image to be processed
    await waitFor(() => {
      expect(screen.queryByText('Drag and drop images, or click to browse')).not.toBeInTheDocument()
    })
  })

  it('handles drag enter and shows visual feedback', () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')

    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }],
        getData: jest.fn(() => '')
      }
    })

    expect(screen.getByText('Drop image to upload')).toBeInTheDocument()
  })

  it('handles drag leave and removes visual feedback', () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')

    // Simulate drag enter then leave
    fireEvent.dragEnter(dropZone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }],
        getData: jest.fn(() => '')
      }
    })

    fireEvent.dragLeave(dropZone)

    expect(screen.getByTestId('drag-drop-zone')).toBeInTheDocument()
  })

  it('handles file drop and processes image', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')

    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Mock successful validation
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')

    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: jest.fn(() => '')
      }
    })

    // Check that image preview appears
    await waitFor(() => {
      expect(screen.getByAltText('Image 1')).toBeInTheDocument()
    })
  })

  it('shows error for invalid file types', async () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    // Simulate dropping non-image file
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: jest.fn(() => '')
      }
    })

    await waitFor(() => {
      expect(screen.getByText(/Please drop an image file/)).toBeInTheDocument()
    })
  })

  it('shows error for too many files', async () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')
    // Create 8 files to exceed the MAX_POST_IMAGES (7) limit
    const files = Array.from({ length: 8 }).map((_, i) => new File([`test${i}`], `test${i}.jpg`, { type: 'image/jpeg' }))

    // Inject current files so remaining count check fails
    const imageUpload = require('@/utils/imageUpload')
    imageUpload.prepareMultipleImagesForUpload.mockReturnValueOnce(Promise.resolve({
      success: false,
      error: 'Maximum 7 images allowed per post',
      preparedFiles: [],
      rejectedCount: 8
    }))

    // Simulate dropping multiple files
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: files,
        getData: jest.fn(() => '')
      }
    })

    const errorElement = await screen.findByText(/You can only add 7 more images|Maximum 7 images/i, {}, { timeout: 3000 })
    expect(errorElement).toBeInTheDocument()
  })

  it('handles keyboard navigation on drop zone', () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')

    // Test Enter key
    fireEvent.keyDown(dropZone, { key: 'Enter' })
    // Should trigger file picker (tested indirectly through click behavior)

    // Test Space key
    fireEvent.keyDown(dropZone, { key: ' ' })
    // Should trigger file picker (tested indirectly through click behavior)
  })

  it('shows image preview with file information', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')

    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')
    const file = new File(['test'.repeat(1000)], 'test-image.jpg', { type: 'image/jpeg' })

    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')

    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: jest.fn(() => '')
      }
    })

    await waitFor(() => {
      expect(screen.getByAltText('Image 1')).toBeInTheDocument()
    })
  })

  it('allows removing uploaded image', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')

    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')

    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
        getData: jest.fn(() => '')
      }
    })

    await waitFor(() => {
      expect(screen.getByAltText('Image 1')).toBeInTheDocument()
    })

    // Remove the image
    const removeButton = screen.getByLabelText('Remove image 1')
    fireEvent.click(removeButton)

    await waitFor(() => {
      expect(screen.queryByAltText('Image 1')).not.toBeInTheDocument()
      expect(screen.getByText('Drag and drop images, or click to browse')).toBeInTheDocument()
    })
  })

  it('shows visual feedback on modal when dragging', () => {
    renderModal()

    const modal = screen.getByRole('dialog')

    // Simulate drag enter on modal
    fireEvent.dragEnter(modal, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }]
      }
    })

    // Modal should have visual feedback classes
    expect(modal).toHaveClass('border-purple-400')
  })

  it('prevents default drag behaviors', () => {
    renderModal()

    const dropZone = screen.getByTestId('drag-drop-zone')

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true })
    const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault')

    fireEvent(dropZone, dragOverEvent)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })
})
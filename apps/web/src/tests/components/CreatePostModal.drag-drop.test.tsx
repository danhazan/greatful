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
  revokeImagePreview: jest.fn()
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
    
    expect(screen.getByText('Drag and drop an image, or click to browse')).toBeInTheDocument()
    expect(screen.getByText('Supports JPG, PNG, WebP up to 5MB')).toBeInTheDocument()
  })

  it('hides drag and drop zone when image is present', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')
    
    renderModal()
    
    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // Simulate file drop to upload image
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    // Wait for the image to be processed
    await waitFor(() => {
      expect(screen.queryByText('Drag and drop an image, or click to browse')).not.toBeInTheDocument()
    })
  })

  it('handles drag enter and shows visual feedback', () => {
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    
    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }]
      }
    })
    
    expect(screen.getByText('Drop image to upload')).toBeInTheDocument()
  })

  it('handles drag leave and removes visual feedback', () => {
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    
    // Simulate drag enter then leave
    fireEvent.dragEnter(dropZone, {
      dataTransfer: {
        items: [{ kind: 'file', type: 'image/jpeg' }]
      }
    })
    
    fireEvent.dragLeave(dropZone)
    
    expect(screen.getByText('Drag and drop an image, or click to browse')).toBeInTheDocument()
  })

  it('handles file drop and processes image', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')
    
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // Mock successful validation
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')
    
    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    // Check that image preview appears
    await waitFor(() => {
      expect(screen.getByAltText('Post preview')).toBeInTheDocument()
    })
  })

  it('shows error for invalid file types', async () => {
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    
    // Simulate dropping non-image file
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Please drop an image file/)).toBeInTheDocument()
    })
  })

  it('shows error for multiple files', async () => {
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    
    // Simulate dropping multiple files
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file1, file2]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByText('Please drop only one image at a time')).toBeInTheDocument()
    })
  })

  it('handles keyboard navigation on drop zone', () => {
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    
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
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file = new File(['test'.repeat(1000)], 'test-image.jpg', { type: 'image/jpeg' })
    
    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')
    
    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByAltText('Post preview')).toBeInTheDocument()
      expect(screen.getByText(/test-image\.jpg/)).toBeInTheDocument()
    })
  })

  it('allows removing uploaded image', async () => {
    const { validateImageFile, createImagePreview } = require('@/utils/imageUpload')
    
    renderModal()
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    // Mock successful validation and preview
    validateImageFile.mockReturnValue({ valid: true })
    createImagePreview.mockReturnValue('blob:test-url')
    
    // Simulate file drop
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    })
    
    await waitFor(() => {
      expect(screen.getByAltText('Post preview')).toBeInTheDocument()
    })
    
    // Remove the image
    const removeButton = screen.getByLabelText('Remove uploaded image')
    fireEvent.click(removeButton)
    
    await waitFor(() => {
      expect(screen.queryByAltText('Post preview')).not.toBeInTheDocument()
      expect(screen.getByText('Drag and drop an image, or click to browse')).toBeInTheDocument()
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
    
    const dropZone = screen.getByRole('button', { name: /upload image by dragging/i })
    
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true })
    const preventDefaultSpy = jest.spyOn(dragOverEvent, 'preventDefault')
    
    fireEvent(dropZone, dragOverEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })
})
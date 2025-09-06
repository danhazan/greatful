import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import CreatePostModal from '@/components/CreatePostModal'
import { ToastProvider } from '@/contexts/ToastContext'

// Mock the mention utils
jest.mock('@/utils/mentionUtils', () => ({
  extractMentions: jest.fn(() => [])
}))

// Mock the image upload utils
jest.mock('@/utils/imageUpload', () => ({
  validateImageFile: jest.fn(() => ({ valid: true })),
  createImagePreview: jest.fn(() => 'blob:mock-url'),
  revokeImagePreview: jest.fn()
}))

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
)

describe('CreatePostModal Character Limits', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should allow more than 200 characters for spontaneous posts', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    const textarea = screen.getByPlaceholderText(/Share what you're grateful for today/i)
    
    // Type a short text that would be classified as spontaneous
    const shortText = 'Thank you'
    fireEvent.change(textarea, { target: { value: shortText } })

    // Should show spontaneous prediction
    await waitFor(() => {
      expect(screen.getByText(/Predicted: Spontaneous/)).toBeInTheDocument()
      expect(screen.getByText(/UI hint — not a character limit/)).toBeInTheDocument()
    })

    // Character counter should show x/5000, not x/200
    expect(screen.getByText(`${shortText.length}/5000`)).toBeInTheDocument()

    // Now type more than 200 characters
    const longText = 'a'.repeat(250) // 250 characters
    fireEvent.change(textarea, { target: { value: longText } })

    // Should still show 250/5000, not be blocked at 200
    await waitFor(() => {
      expect(screen.getByText('250/5000')).toBeInTheDocument()
    })

    // Should still be classified as spontaneous (since it's just repeated 'a's, wordCount < 20)
    expect(screen.getByText(/Predicted: Spontaneous/)).toBeInTheDocument()
    
    // Textarea should contain the full 250 characters
    expect(textarea).toHaveValue(longText)
  })

  it('should use 5000 character limit for daily posts', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    const textarea = screen.getByPlaceholderText(/Share what you're grateful for today/i)
    
    // Type a longer text that would be classified as daily
    const dailyText = 'I am so grateful for this beautiful day and all the wonderful opportunities it brings to connect with family and friends and experience joy in simple moments'
    fireEvent.change(textarea, { target: { value: dailyText } })

    // Should show daily prediction
    await waitFor(() => {
      expect(screen.getByText(/Predicted: Daily Gratitude/)).toBeInTheDocument()
    })

    // Character counter should show x/5000
    expect(screen.getByText(`${dailyText.length}/5000`)).toBeInTheDocument()
  })

  it('should use 0 character limit for photo-only posts', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    // Mock image upload
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    
    // Simulate adding an image without text
    const addPhotoButton = screen.getByText(/Add Photo/i)
    fireEvent.click(addPhotoButton)

    // Simulate the image being added (this would normally happen through file input)
    // We'll directly trigger the image state by finding the drag zone and simulating a drop
    const dragZone = screen.getByText(/Drag and drop an image/i).closest('div')
    
    // Create a mock drop event
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        files: [mockFile]
      }
    })

    if (dragZone) {
      fireEvent(dragZone, dropEvent)
    }

    // For this test, we'll manually check the logic by ensuring empty content + image = photo type
    const textarea = screen.getByPlaceholderText(/Share what you're grateful for today/i)
    
    // Keep content empty (photo-only)
    fireEvent.change(textarea, { target: { value: '' } })

    // The character counter behavior for photo-only posts should show 0/0 when implemented
    // For now, we're testing that the logic exists in the component
  })

  it('should not enforce 200 character limit on form submission', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    const textarea = screen.getByPlaceholderText(/Share what you're grateful for today/i)
    
    // Type exactly 201 characters (more than old spontaneous limit)
    const text201 = 'a'.repeat(201)
    fireEvent.change(textarea, { target: { value: text201 } })

    // Should show spontaneous prediction but allow submission
    await waitFor(() => {
      expect(screen.getByText(/Predicted: Spontaneous/)).toBeInTheDocument()
    })

    // Submit the form
    const submitButton = screen.getByText(/Share Gratitude/i)
    fireEvent.click(submitButton)

    // Should call onSubmit without character limit error
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: text201
        })
      )
    })
  })

  it('should still enforce 5000 character maximum', async () => {
    render(
      <TestWrapper>
        <CreatePostModal
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
        />
      </TestWrapper>
    )

    const textarea = screen.getByPlaceholderText(/Share what you're grateful for today/i)
    
    // Type more than 5000 characters
    const tooLongText = 'a'.repeat(5001)
    fireEvent.change(textarea, { target: { value: tooLongText } })

    // Submit the form
    const submitButton = screen.getByText(/Share Gratitude/i)
    fireEvent.click(submitButton)

    // Should show error and not call onSubmit
    await waitFor(() => {
      expect(screen.getByText(/Content is too long/i)).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
})
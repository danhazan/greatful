import { render, screen, fireEvent, waitFor } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import CreatePostModal from '../../components/CreatePostModal'

// Mock the image upload utilities
jest.mock('@/utils/imageUpload', () => ({
  validateImageFile: jest.fn(() => ({ valid: true })),
  createImagePreview: jest.fn(() => 'blob:mock-url'),
  revokeImagePreview: jest.fn(),
}))

// Mock fetch for image upload
global.fetch = jest.fn()

describe('CreatePostModal Character Counter', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/uploaded-image.jpg' })
    })
  })

  it('should show 0/5000 when text is empty', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Wait for the modal to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    })

    // Check that character counter shows 0/5000 initially
    expect(screen.getByText('0/5000')).toBeInTheDocument()
  })

  it('should show 0/5000 when all text is deleted', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Wait for the modal to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    })

    // Find the rich text editor content area
    const editor = screen.getByRole('textbox')
    
    // Type some text
    fireEvent.input(editor, { target: { textContent: 'Hello world' } })
    
    // Wait for character counter to update
    await waitFor(() => {
      expect(screen.getByText('11/5000')).toBeInTheDocument()
    })

    // Clear all text by selecting all and deleting
    fireEvent.keyDown(editor, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(editor, { key: 'Delete' })
    fireEvent.input(editor, { target: { textContent: '' } })

    // Character counter should show 0/5000, not 4/5000 or any other number
    await waitFor(() => {
      expect(screen.getByText('0/5000')).toBeInTheDocument()
    })
  })

  it('should accurately count characters with various text manipulations', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Wait for the modal to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    
    // Test typing text
    fireEvent.input(editor, { target: { textContent: 'Test' } })
    await waitFor(() => {
      expect(screen.getByText('4/5000')).toBeInTheDocument()
    })

    // Test pasting text (simulate longer content)
    fireEvent.input(editor, { target: { textContent: 'This is a longer test message' } })
    await waitFor(() => {
      expect(screen.getByText('29/5000')).toBeInTheDocument()
    })

    // Test cutting all text (simulate Ctrl+A, Ctrl+X)
    fireEvent.input(editor, { target: { textContent: '' } })
    await waitFor(() => {
      expect(screen.getByText('0/5000')).toBeInTheDocument()
    })
  })

  it('should handle rich text formatting without affecting character count', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Wait for the modal to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    
    // Type text and apply formatting (this might create HTML tags)
    fireEvent.input(editor, { target: { textContent: 'Bold text' } })
    
    // Even with HTML formatting like <b>Bold text</b>, the character count should be 9
    await waitFor(() => {
      expect(screen.getByText('9/5000')).toBeInTheDocument()
    })

    // Clear the formatted text
    fireEvent.input(editor, { target: { textContent: '' } })
    
    // Should show 0/5000, not the length of empty HTML tags
    await waitFor(() => {
      expect(screen.getByText('0/5000')).toBeInTheDocument()
    })
  })

  it('should handle empty HTML content correctly', async () => {
    render(
      <CreatePostModal
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
      />
    )

    // Wait for the modal to be fully rendered
    await waitFor(() => {
      expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    
    // Simulate the scenario where rich text editor has HTML but no plain text
    // This could happen when all text is deleted but HTML structure remains
    Object.defineProperty(editor, 'innerHTML', {
      value: '<p><br></p>',
      writable: true
    })
    
    // Trigger input event to update the character counter
    fireEvent.input(editor, { target: { textContent: '' } })
    
    // Character counter should show 0/5000, not 9/5000 (length of '<p><br></p>')
    await waitFor(() => {
      expect(screen.getByText('0/5000')).toBeInTheDocument()
    })
  })
})
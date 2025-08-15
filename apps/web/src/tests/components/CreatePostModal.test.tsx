import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CreatePostModal from '@/components/CreatePostModal'

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('CreatePostModal', () => {
  const mockOnClose = jest.fn()
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onSubmit: mockOnSubmit,
  }

  it('renders when open', () => {
    render(<CreatePostModal {...defaultProps} />)
    
    expect(screen.getByText('Share Your Gratitude')).toBeInTheDocument()
    expect(screen.getByText('Post Type')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Share what you\'re grateful for today...')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<CreatePostModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Share Your Gratitude')).not.toBeInTheDocument()
  })

  it('displays all post types with correct information', () => {
    render(<CreatePostModal {...defaultProps} />)
    
    expect(screen.getByText('Daily Gratitude')).toBeInTheDocument()
    expect(screen.getByText('Photo Gratitude')).toBeInTheDocument()
    expect(screen.getByText('Spontaneous Text')).toBeInTheDocument()
    
    expect(screen.getByText('500 chars • 3x larger display')).toBeInTheDocument()
    expect(screen.getByText('300 chars • 2x boost display')).toBeInTheDocument()
    expect(screen.getByText('200 chars • Compact display')).toBeInTheDocument()
  })

  it('allows post type selection', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    const photoButton = screen.getByText('Photo Gratitude').closest('button')!
    await act(async () => {
      await user.click(photoButton)
    })
    
    // Check that photo type is selected by looking for the purple styling
    expect(photoButton).toHaveClass('border-purple-500', 'bg-purple-50')
    
    // Check that the textarea has the correct maxlength for photo type
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    expect(textarea).toHaveAttribute('maxlength', '300')
  })

  it('enforces character limits based on post type', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    // Switch to spontaneous (200 char limit)
    const spontaneousButton = screen.getByText('Spontaneous Text').closest('button')!
    await act(async () => {
      await user.click(spontaneousButton)
    })
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    const longText = 'a'.repeat(250) // Exceeds 200 char limit
    
    await act(async () => {
      await user.type(textarea, longText)
    })
    
    // Should be truncated to 200 characters
    expect(textarea).toHaveValue('a'.repeat(200))
  })

  it('shows character count and updates color when approaching limit', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    // Switch to spontaneous (200 char limit)
    const spontaneousButton = screen.getByText('Spontaneous Text').closest('button')!
    await act(async () => {
      await user.click(spontaneousButton)
    })
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    const nearLimitText = 'a'.repeat(190) // 95% of 200 char limit
    
    await act(async () => {
      await user.type(textarea, nearLimitText)
    })
    
    // Check that the textarea has the correct content
    expect(textarea).toHaveValue(nearLimitText)
    
    // Check that there's a red-colored element (character count warning)
    const redElement = document.querySelector('.text-red-500')
    expect(redElement).toBeInTheDocument()
  })

  it('disables submit button when no content', async () => {
    render(<CreatePostModal {...defaultProps} />)
    
    const submitButton = screen.getByText('Share Gratitude')
    expect(submitButton).toBeDisabled()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('validates required content when form is submitted with spaces only', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    
    // Add some content first to enable the button
    await act(async () => {
      await user.type(textarea, 'test')
    })
    
    // Then clear it with just spaces
    await act(async () => {
      await user.clear(textarea)
      await user.type(textarea, '   ')
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    
    // Button should still be disabled because content.trim() is empty
    expect(submitButton).toBeDisabled()
  })

  it('validates content length before submission', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    // Switch to spontaneous (200 char limit)
    const spontaneousButton = screen.getByText('Spontaneous Text').closest('button')!
    await act(async () => {
      await user.click(spontaneousButton)
    })
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    // Manually set a value that exceeds the limit (simulating paste)
    act(() => {
      fireEvent.change(textarea, { target: { value: 'a'.repeat(250) } })
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    await act(async () => {
      await user.click(submitButton)
    })
    
    expect(screen.getByText('Content is too long. Maximum 200 characters for Spontaneous Text')).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('submits valid post data', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValue(undefined)
    
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    await act(async () => {
      await user.type(textarea, 'I am grateful for this beautiful day!')
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    await act(async () => {
      await user.click(submitButton)
    })
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: 'I am grateful for this beautiful day!',
        postType: 'daily',
        imageUrl: undefined,
        location: undefined,
      })
    })
  })

  it('handles submission errors', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockRejectedValue(new Error('Network error'))
    
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    await act(async () => {
      await user.type(textarea, 'Test content')
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    await act(async () => {
      await user.click(submitButton)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('saves draft to localStorage', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    await act(async () => {
      await user.type(textarea, 'Draft content')
    })
    
    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'grateful_post_draft',
        JSON.stringify({
          content: 'Draft content',
          postType: 'daily',
          imageUrl: '',
          location: ''
        })
      )
    })
  })

  it('loads draft from localStorage on open', () => {
    const draftData = {
      content: 'Saved draft',
      postType: 'photo',
      imageUrl: '',
      location: ''
    }
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(draftData))
    
    render(<CreatePostModal {...defaultProps} />)
    
    expect(screen.getByDisplayValue('Saved draft')).toBeInTheDocument()
    
    // Check that photo type is selected
    const photoButton = screen.getByText('Photo Gratitude').closest('button')!
    expect(photoButton).toHaveClass('border-purple-500', 'bg-purple-50')
    
    // Check that the textarea has the correct maxlength for photo type
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    expect(textarea).toHaveAttribute('maxlength', '300')
  })

  it('clears draft after successful submission', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockResolvedValue(undefined)
    
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    await act(async () => {
      await user.type(textarea, 'Test content')
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    await act(async () => {
      await user.click(submitButton)
    })
    
    await waitFor(() => {
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('grateful_post_draft')
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  it('closes modal when clicking close button', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    const closeButton = screen.getByLabelText('Close modal')
    await act(async () => {
      await user.click(closeButton)
    })
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes modal when clicking cancel button', async () => {
    const user = userEvent.setup()
    render(<CreatePostModal {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    await act(async () => {
      await user.click(cancelButton)
    })
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables submit button when submitting', async () => {
    const user = userEvent.setup()
    // Mock a slow submission
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
    
    render(<CreatePostModal {...defaultProps} />)
    
    const textarea = screen.getByPlaceholderText('Share what you\'re grateful for today...')
    
    await act(async () => {
      await user.type(textarea, 'Test content')
    })
    
    const submitButton = screen.getByText('Share Gratitude')
    
    await act(async () => {
      await user.click(submitButton)
    })
    
    expect(screen.getByText('Sharing...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('shows draft saved indicator', () => {
    render(<CreatePostModal {...defaultProps} />)
    
    expect(screen.getByText('Draft saved automatically')).toBeInTheDocument()
  })
})
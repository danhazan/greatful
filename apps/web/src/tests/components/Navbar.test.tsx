import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock NotificationSystem component
jest.mock('@/components/NotificationSystem', () => {
  return function MockNotificationSystem({ userId }: { userId: string }) {
    return <div data-testid="notification-system">Notifications for {userId}</div>
  }
})

const mockPush = jest.fn()
const mockBack = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
    back: mockBack,
  })
})

describe('Navbar Component', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com'
  }

  it('renders the Grateful logo and title', () => {
    render(<Navbar />)
    
    expect(screen.getByText('💜')).toBeInTheDocument()
    expect(screen.getByText('Grateful')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Navbar />)
    
    expect(screen.getByText('Feed')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('shows user welcome message when user is provided', () => {
    render(<Navbar user={mockUser} />)
    
    expect(screen.getByText('Welcome, John Doe!')).toBeInTheDocument()
  })

  it('renders NotificationSystem when user is provided', () => {
    render(<Navbar user={mockUser} />)
    
    const notificationSystem = screen.getByTestId('notification-system')
    expect(notificationSystem).toBeInTheDocument()
    expect(notificationSystem).toHaveTextContent('Notifications for user-123')
  })

  it('does not render NotificationSystem when user is not provided', () => {
    render(<Navbar />)
    
    expect(screen.queryByTestId('notification-system')).not.toBeInTheDocument()
  })

  it('shows back button when showBackButton is true', () => {
    render(<Navbar showBackButton={true} />)
    
    const backButton = screen.getByRole('button', { name: /go back/i })
    expect(backButton).toBeInTheDocument()
  })

  it('does not show back button by default', () => {
    render(<Navbar />)
    
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  it('navigates to feed when logo is clicked', () => {
    render(<Navbar />)
    
    const logoButton = screen.getByRole('button', { name: /grateful/i })
    fireEvent.click(logoButton)
    
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('navigates to feed when Feed link is clicked', () => {
    render(<Navbar />)
    
    const feedLink = screen.getByText('Feed')
    fireEvent.click(feedLink)
    
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('navigates to profile when Profile link is clicked', () => {
    render(<Navbar />)
    
    const profileLink = screen.getByText('Profile')
    fireEvent.click(profileLink)
    
    expect(mockPush).toHaveBeenCalledWith('/profile')
  })

  it('calls onLogout when provided and Logout is clicked', () => {
    const mockOnLogout = jest.fn()
    render(<Navbar onLogout={mockOnLogout} />)
    
    const logoutButton = screen.getByText('Logout')
    fireEvent.click(logoutButton)
    
    expect(mockOnLogout).toHaveBeenCalled()
  })

  it('handles logout with default behavior when onLogout is not provided', () => {
    // Mock localStorage
    const mockRemoveItem = jest.fn()
    Object.defineProperty(window, 'localStorage', {
      value: {
        removeItem: mockRemoveItem,
      },
      writable: true,
    })

    render(<Navbar />)
    
    const logoutButton = screen.getByText('Logout')
    fireEvent.click(logoutButton)
    
    expect(mockRemoveItem).toHaveBeenCalledWith('access_token')
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('navigates back when back button is clicked', () => {
    render(<Navbar showBackButton={true} />)
    
    const backButton = screen.getByRole('button', { name: /go back/i })
    fireEvent.click(backButton)
    
    expect(mockBack).toHaveBeenCalled()
  })

  it('applies correct styling classes', () => {
    render(<Navbar user={mockUser} showBackButton={true} />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('bg-white', 'border-b', 'border-gray-200')
    
    const logoButton = screen.getByRole('button', { name: /grateful/i })
    expect(logoButton).toHaveClass('flex', 'items-center', 'space-x-2')
  })
})
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

// Mock ProfileDropdown component
jest.mock('@/components/ProfileDropdown', () => {
  return function MockProfileDropdown({ user }: { user: any }) {
    return (
      <button aria-label={`${user.name}'s profile`}>
        Profile Dropdown for {user.name}
      </button>
    )
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

  it('does not render mobile menu button (removed in favor of profile dropdown)', () => {
    render(<Navbar />)
    
    const mobileMenuButton = screen.queryByRole('button', { name: /open menu/i })
    expect(mobileMenuButton).not.toBeInTheDocument()
  })

  it('shows profile dropdown when user is provided', () => {
    render(<Navbar user={mockUser} />)
    
    const profileButton = screen.getByRole('button', { name: /John Doe's profile/i })
    expect(profileButton).toBeInTheDocument()
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

  it('shows feed icon when user is provided', () => {
    render(<Navbar user={mockUser} />)
    
    const feedButton = screen.getByRole('button', { name: 'Go to feed' })
    expect(feedButton).toBeInTheDocument()
    expect(feedButton).toHaveAttribute('title', 'Feed')
  })

  it('does not show feed icon when user is not provided', () => {
    render(<Navbar />)
    
    expect(screen.queryByRole('button', { name: 'Go to feed' })).not.toBeInTheDocument()
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

  it('navigates to feed when feed icon is clicked', () => {
    render(<Navbar user={mockUser} />)
    
    const feedButton = screen.getByRole('button', { name: 'Go to feed' })
    fireEvent.click(feedButton)
    
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('navigates to feed when logo is clicked', () => {
    render(<Navbar user={mockUser} />)
    
    const logoButton = screen.getByRole('button', { name: /go to grateful home/i })
    expect(logoButton).toBeInTheDocument()
    
    fireEvent.click(logoButton)
    
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it('logo is not clickable when no user is provided', () => {
    render(<Navbar />)
    
    expect(screen.queryByRole('button', { name: /go to grateful home/i })).not.toBeInTheDocument()
    expect(screen.getByText('💜')).toBeInTheDocument()
    expect(screen.getByText('Grateful')).toBeInTheDocument()
  })

  it('does not show mobile menu overlay (removed in favor of profile dropdown)', () => {
    render(<Navbar />)
    
    // Mobile menu no longer exists
    expect(screen.queryByText('Feed')).not.toBeInTheDocument()
    expect(screen.queryByText('Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('Logout')).not.toBeInTheDocument()
  })

  it('navigation is now handled through profile dropdown (mobile menu removed)', () => {
    render(<Navbar user={mockUser} />)
    
    // Profile dropdown is now the primary navigation method
    const profileButton = screen.getByRole('button', { name: /John Doe's profile/i })
    expect(profileButton).toBeInTheDocument()
    
    // Mobile menu no longer exists
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument()
  })

  it('logout functionality is now handled through ProfileDropdown component', () => {
    const mockOnLogout = jest.fn()
    render(<Navbar user={mockUser} onLogout={mockOnLogout} />)
    
    // ProfileDropdown handles logout functionality
    const profileButton = screen.getByRole('button', { name: /John Doe's profile/i })
    expect(profileButton).toBeInTheDocument()
    
    // Mobile menu logout no longer exists
    expect(screen.queryByText('Logout')).not.toBeInTheDocument()
  })

  it('default logout behavior is now handled by ProfileDropdown component', () => {
    render(<Navbar user={mockUser} />)
    
    // ProfileDropdown handles default logout behavior
    const profileButton = screen.getByRole('button', { name: /John Doe's profile/i })
    expect(profileButton).toBeInTheDocument()
    
    // Mobile menu logout no longer exists
    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument()
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
    
    const feedButton = screen.getByRole('button', { name: 'Go to feed' })
    expect(feedButton).toHaveClass('text-purple-600', 'hover:text-purple-700', 'transition-colors')
  })
})
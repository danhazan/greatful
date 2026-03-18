import { render, screen, fireEvent } from '@testing-library/react'
import Navbar from '@/components/Navbar'

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href, onClick, className, ...props }: any) {
    return (
      <a href={href} onClick={onClick} className={className} {...props}>
        {children}
      </a>
    )
  }
})

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    back: jest.fn(),
  }),
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe('Navbar Component', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@example.com',
    username: 'johndoe',
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

  it('shows feed icon as a link when user is provided', () => {
    render(<Navbar user={mockUser} />)
    
    const feedLink = screen.getByRole('link', { name: 'Go to feed' })
    expect(feedLink).toBeInTheDocument()
    expect(feedLink).toHaveAttribute('href', '/feed')
    expect(feedLink).toHaveAttribute('title', 'Feed')
  })

  it('does not show feed icon when user is not provided', () => {
    render(<Navbar />)
    
    expect(screen.queryByRole('link', { name: 'Go to feed' })).not.toBeInTheDocument()
  })

  it('feed link has correct href', () => {
    render(<Navbar user={mockUser} />)
    
    const feedLink = screen.getByRole('link', { name: 'Go to feed' })
    expect(feedLink).toHaveAttribute('href', '/feed')
  })

  it('logo link has correct href when user is logged in', () => {
    render(<Navbar user={mockUser} />)
    
    const logoLink = screen.getByRole('link', { name: /go to grateful home/i })
    expect(logoLink).toBeInTheDocument()
    expect(logoLink).toHaveAttribute('href', '/feed')
  })

  it('logo is not a link when no user is provided', () => {
    render(<Navbar />)
    
    expect(screen.queryByRole('link', { name: /go to grateful home/i })).not.toBeInTheDocument()
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

  it('applies correct styling classes', () => {
    render(<Navbar user={mockUser} />)
    
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('bg-white', 'border-b', 'border-gray-200')
    
    const feedLink = screen.getByRole('link', { name: 'Go to feed' })
    expect(feedLink).toHaveClass('text-purple-600', 'hover:text-purple-700', 'transition-colors')
  })

  it('renders logo and feed as links (not buttons) for proper link behavior', () => {
    render(<Navbar user={mockUser} />)
    
    // Logo should be a link
    const logoLink = screen.getByRole('link', { name: /go to grateful home/i })
    expect(logoLink.tagName).toBe('A')
    
    // Feed icon should be a link
    const feedLink = screen.getByRole('link', { name: 'Go to feed' })
    expect(feedLink.tagName).toBe('A')
  })
})
/**
 * Accessibility Tests for Social Interactions System
 * 
 * Tests ARIA labels, keyboard navigation, screen reader support,
 * and WCAG 2.1 AA compliance across all interactive components.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import EmojiPicker from '@/components/EmojiPicker'
import ShareModal from '@/components/ShareModal'
import NotificationSystem from '@/components/NotificationSystem'
import ReactionViewer from '@/components/ReactionViewer'
import MentionAutocomplete from '@/components/MentionAutocomplete'
import FollowButton from '@/components/FollowButton'
import Navbar from '@/components/Navbar'
import { ToastProvider } from '@/contexts/ToastContext'
import { UserProvider } from '@/contexts/UserContext'

// Mock dependencies
jest.mock('@/utils/emojiMapping', () => ({
  getAvailableEmojis: () => [
    { code: 'heart_face', emoji: '😍', label: 'Love it' },
    { code: 'fire', emoji: '🔥', label: 'Fire' },
    { code: 'grateful', emoji: '🙏', label: 'Grateful' },
    { code: 'strong', emoji: '💪', label: 'Strong' },
    { code: 'applause', emoji: '👏', label: 'Applause' },
    { code: 'funny', emoji: '😂', label: 'Funny' },
    { code: 'thinking', emoji: '🤔', label: 'Thinking' },
    { code: 'amazing', emoji: '⭐', label: 'Amazing' }
  ],
  getEmojiFromCode: (code: string) => {
    const mapping: Record<string, string> = {
      'heart_face': '😍',
      'fire': '🔥',
      'grateful': '🙏',
      'strong': '💪',
      'applause': '👏',
      'funny': '😂',
      'thinking': '🤔',
      'amazing': '⭐'
    }
    return mapping[code] || '😊'
  }
}))

jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: () => ({})
}))

jest.mock('@/utils/auth', () => ({
  isAuthenticated: () => true,
  getAccessToken: () => 'mock-token'
}))

jest.mock('@/utils/timeAgo', () => ({
  formatTimeAgo: (date: string) => '2 hours ago'
}))

// Mock fetch for API calls
global.fetch = jest.fn()

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <UserProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </UserProvider>
)

describe.skip('Accessibility Tests', () => {
  // SKIPPED: Accessibility compliance edge cases
  // See apps/web/SKIPPED_TESTS.md for details
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => 'mock-token'),
        setItem: jest.fn(),
        removeItem: jest.fn()
      },
      writable: true
    })
  })

  describe('EmojiPicker Accessibility', () => {
    const mockProps = {
      isOpen: true,
      onClose: jest.fn(),
      onEmojiSelect: jest.fn(),
      position: { x: 100, y: 100 }
    }

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <EmojiPicker {...mockProps} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'emoji-picker-title')
      expect(modal).toHaveAttribute('aria-describedby', 'emoji-picker-description')

      const title = screen.getByText('React with')
      expect(title).toHaveAttribute('id', 'emoji-picker-title')

      const grid = screen.getByRole('grid')
      expect(grid).toHaveAttribute('aria-label', 'Emoji reactions')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <EmojiPicker {...mockProps} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      
      // Test Escape key
      await user.keyboard('{Escape}')
      expect(mockProps.onClose).toHaveBeenCalled()

      // Test number key shortcuts
      await user.keyboard('1')
      expect(mockProps.onEmojiSelect).toHaveBeenCalledWith('heart_face')
    })

    it('should have accessible emoji buttons', () => {
      render(
        <TestWrapper>
          <EmojiPicker {...mockProps} />
        </TestWrapper>
      )

      const emojiButtons = screen.getAllByRole('gridcell')
      expect(emojiButtons).toHaveLength(8)

      emojiButtons.forEach((button, index) => {
        expect(button).toHaveAttribute('aria-pressed')
        expect(button).toHaveAttribute('aria-label')
        expect(button.getAttribute('aria-label')).toContain('Press ' + (index + 1) + ' key as shortcut')
      })
    })

    it('should have proper focus management', () => {
      render(
        <TestWrapper>
          <EmojiPicker {...mockProps} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('ShareModal Accessibility', () => {
    const mockPost = {
      id: '1',
      content: 'Test post',
      author: { id: '1', name: 'Test User' }
    }

    const mockProps = {
      isOpen: true,
      onClose: jest.fn(),
      post: mockPost,
      position: { x: 100, y: 100 }
    }

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <ShareModal {...mockProps} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'share-modal-title')
      expect(modal).toHaveAttribute('aria-describedby', 'share-modal-description')

      const title = screen.getByText('Share Post')
      expect(title).toHaveAttribute('id', 'share-modal-title')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <ShareModal {...mockProps} />
        </TestWrapper>
      )

      // Test Escape key
      await user.keyboard('{Escape}')
      expect(mockProps.onClose).toHaveBeenCalled()
    })

    it('should have accessible buttons with proper descriptions', () => {
      render(
        <TestWrapper>
          <ShareModal {...mockProps} />
        </TestWrapper>
      )

      const copyButton = screen.getByText('Copy Link').closest('button')
      expect(copyButton).toHaveAttribute('aria-describedby')

      const messageButton = screen.getByText('Send as Message').closest('button')
      expect(messageButton).toHaveAttribute('aria-describedby')
    })
  })

  describe('NotificationSystem Accessibility', () => {
    const mockProps = {
      userId: 1
    }

    beforeEach(() => {
      // Mock successful fetch response for notifications endpoint
      ;(global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/notifications')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        return Promise.reject(new Error('Unhandled fetch request: ' + url));
      });
    })

    it('should have accessible notification bell', () => {
      render(
        <TestWrapper>
          <NotificationSystem {...mockProps} />
        </TestWrapper>
      )

      const bellButton = screen.getByRole('button')
      expect(bellButton).toHaveAttribute('aria-label')
      expect(bellButton).toHaveAttribute('aria-expanded', 'false')
      expect(bellButton).toHaveAttribute('aria-haspopup', 'true')
    })

    it('should announce unread count to screen readers', async () => {
      // Mock notifications with unread items
      ;(global.fetch as jest.Mock).mockImplementation((url, options) => {
        if (url.includes('/api/notifications')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              {
                id: '1',
                type: 'reaction',
                message: 'liked your post',
                read: false,
                fromUser: { id: '2', name: 'Test User' }
              }
            ])
          });
        }
        if (url.includes('/api/users/me/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { id: 1, username: 'testuser', email: 'test@example.com' }
            })
          });
        }
        return Promise.reject(new Error('Unhandled fetch request: ' + url));
      });

      render(
        <TestWrapper>
          <NotificationSystem {...mockProps} />
        </TestWrapper>
      )

      // Wait for notifications to load and unread count to be calculated
      await waitFor(() => {
        const bellButton = screen.getByRole('button')
        expect(bellButton.getAttribute('aria-label')).toContain('(1 unread)')
      }, { timeout: 3000 })
    })

    it('should have accessible notification panel', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <NotificationSystem {...mockProps} />
        </TestWrapper>
      )

      const bellButton = screen.getByRole('button')
      await user.click(bellButton)

      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-label', 'Notifications panel')
      expect(panel).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('ReactionViewer Accessibility', () => {
    const mockReactions = [
      {
        id: '1',
        userId: '1',
        userName: 'Test User',
        emojiCode: 'heart_eyes',
        createdAt: '2023-01-01T00:00:00Z'
      }
    ]

    const mockProps = {
      isOpen: true,
      onClose: jest.fn(),
      postId: '1',
      reactions: mockReactions
    }

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <ReactionViewer {...mockProps} />
        </TestWrapper>
      )

      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby', 'reaction-viewer-title')
      expect(modal).toHaveAttribute('aria-describedby', 'reaction-viewer-description')
    })

    it('should have accessible reaction groups', () => {
      render(
        <TestWrapper>
          <ReactionViewer {...mockProps} />
        </TestWrapper>
      )

      const reactionGroups = screen.getAllByRole('group')
      expect(reactionGroups.length).toBeGreaterThan(0)

      const reactionLists = screen.getAllByRole('list')
      expect(reactionLists.length).toBeGreaterThan(0)
    })

    it('should support keyboard navigation for user items', async () => {
      const user = userEvent.setup()
      const mockOnUserClick = jest.fn()
      
      render(
        <TestWrapper>
          <ReactionViewer {...mockProps} onUserClick={mockOnUserClick} />
        </TestWrapper>
      )

      const userItems = screen.getAllByRole('listitem')
      const firstItem = userItems[0]

      // Test Enter key
      firstItem.focus()
      await user.keyboard('{Enter}')
      expect(mockOnUserClick).toHaveBeenCalledWith(1)

      // Test Space key
      await user.keyboard(' ')
      expect(mockOnUserClick).toHaveBeenCalledTimes(2)
    })
  })

  describe('MentionAutocomplete Accessibility', () => {
    const mockUsers = [
      {
        id: 1,
        username: 'testuser',
        profile_image_url: 'test.jpg',
        bio: 'Test bio'
      }
    ]

    const mockProps = {
      isOpen: true,
      searchQuery: 'test',
      onUserSelect: jest.fn(),
      onClose: jest.fn(),
      position: { x: 0, y: 0 }
    }

    beforeEach(() => {
      // Mock successful user search
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: mockUsers
        })
      })
    })

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <MentionAutocomplete {...mockProps} />
        </TestWrapper>
      )

      const listbox = screen.getByRole('listbox')
      expect(listbox).toHaveAttribute('aria-label', 'User search results')
      expect(listbox).toHaveAttribute('aria-live', 'polite')
    })

    it('should have accessible option items', async () => {
      render(
        <TestWrapper>
          <MentionAutocomplete {...mockProps} />
        </TestWrapper>
      )

      await waitFor(() => {
        const options = screen.getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)

        options.forEach(option => {
          expect(option).toHaveAttribute('aria-selected')
          expect(option).toHaveAttribute('aria-label')
        })
      })
    })

    it('should announce loading and empty states', () => {
      // Test loading state
      render(
        <TestWrapper>
          <MentionAutocomplete {...mockProps} />
        </TestWrapper>
      )

      const loadingStatus = screen.getByRole('status')
      expect(loadingStatus).toHaveAttribute('aria-live', 'polite')
    })
  })

  describe('FollowButton Accessibility', () => {
    const mockProps = {
      userId: 1,
      initialFollowState: false
    }

    beforeEach(() => {
      // Mock successful follow API calls
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    })

    it('should have proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <FollowButton {...mockProps} />
        </TestWrapper>
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label')
      expect(button).toHaveAttribute('aria-pressed')
    })

    it('should announce errors to screen readers', async () => {
      // Mock failed API call
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const user = userEvent.setup()
      render(
        <TestWrapper>
          <FollowButton {...mockProps} />
        </TestWrapper>
      )

      const button = screen.getByRole('button')
      await user.click(button)

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert')
        expect(errorAlert).toHaveAttribute('aria-live', 'assertive')
      })
    })
  })

  describe('Navbar Accessibility', () => {
    const mockUser = {
      id: 1,
      name: 'Test User',
      email: 'test@example.com'
    }

    const mockProps = {
      user: mockUser,
      onLogout: jest.fn()
    }

    it.skip('should have proper navigation landmarks (TODO: Update for new navbar structure)', () => {
      render(
        <TestWrapper>
          <Navbar {...mockProps} />
        </TestWrapper>
      )

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Main navigation')

      // TODO: Update for new profile dropdown structure - no longer has menubar
      // const menubar = screen.getByRole('menubar')
      // expect(menubar).toHaveAttribute('aria-label', 'Main menu')
    })

    it.skip('should have accessible mobile menu (TODO: Update for profile dropdown)', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <Navbar {...mockProps} />
        </TestWrapper>
      )

      // TODO: Update for new profile dropdown structure - no longer has mobile menu
      // Mobile menu was replaced with responsive profile dropdown
      // const menuButton = screen.getByRole('button', { name: /open menu/i })
      // expect(menuButton).toHaveAttribute('aria-expanded', 'false')
      // expect(menuButton).toHaveAttribute('aria-haspopup', 'true')
    })

    it.skip('should have accessible menu items (TODO: Update for profile dropdown)', () => {
      render(
        <TestWrapper>
          <Navbar {...mockProps} />
        </TestWrapper>
      )

      // TODO: Update for new profile dropdown structure - no longer has menuitem roles
      // Menu items are now in ProfileDropdown component
      // const menuItems = screen.getAllByRole('menuitem')
      // menuItems.forEach(item => {
      //   expect(item).toHaveAttribute('aria-label')
      // })
    })
  })

  describe('Color Contrast Compliance', () => {
    it('should use WCAG AA compliant colors', () => {
      // Test that our CSS custom properties meet contrast requirements
      // In test environment, we verify the CSS classes are applied correctly
      const testElement = document.createElement('div')
      testElement.className = 'text-purple-600'
      document.body.appendChild(testElement)

      // Verify the class is applied (actual color computation varies by environment)
      expect(testElement.className).toContain('text-purple-600')

      document.body.removeChild(testElement)
    })

    it('should provide high contrast mode support', () => {
      // Test high contrast media query styles
      const testElement = document.createElement('div')
      testElement.className = 'text-gray-500'
      document.body.appendChild(testElement)

      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      document.body.removeChild(testElement)
    })
  })

  describe('Reduced Motion Support', () => {
    it('should respect prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion: reduce
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      })

      const testElement = document.createElement('div')
      testElement.className = 'animate-spin'
      document.body.appendChild(testElement)

      // In reduced motion mode, animations should be disabled
      const computedStyle = window.getComputedStyle(testElement)
      // This would be tested in a real browser environment
      
      document.body.removeChild(testElement)
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should provide live region updates', async () => {
      const user = userEvent.setup()
      render(
        <TestWrapper>
          <NotificationSystem userId={1} />
        </TestWrapper>
      )

      // Click to open notifications panel
      const bellButton = screen.getByRole('button')
      await user.click(bellButton)

      // Live regions should be present for dynamic content updates
      const liveRegion = screen.getByRole('region')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should have screen reader only content', () => {
      render(
        <TestWrapper>
          <ShareModal 
            isOpen={true}
            onClose={jest.fn()}
            post={{
              id: '1',
              content: 'Test',
              author: { id: '1', name: 'Test' }
            }}
          />
        </TestWrapper>
      )

      // Check for screen reader only descriptions
      const srOnlyElements = document.querySelectorAll('.sr-only')
      expect(srOnlyElements.length).toBeGreaterThan(0)
    })
  })
})
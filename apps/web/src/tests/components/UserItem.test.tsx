import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import UserItem from '@/components/UserItem'
import { UserSearchResult } from '@/types/userSearch'

// Mock createTouchHandlers to avoid external dependency issues in tests
jest.mock('@/utils/hapticFeedback', () => ({
  createTouchHandlers: () => ({})
}))

describe('UserItem', () => {
  const mockUser: UserSearchResult = {
    id: 1,
    username: 'testuser',
    displayName: 'Test User',
    profileImageUrl: 'http://example.com/image.jpg',
    bio: 'Test Bio'
  }

  describe('Navigation Mode', () => {
    it('renders as a Link (<a>) with correct href', () => {
      render(
        <UserItem 
          mode="navigation" 
          user={mockUser} 
          href="/profile/1" 
        />
      )
      
      const link = screen.getByRole('link')
      expect(link).toHaveAttribute('href', '/profile/1')
      expect(link.tagName).toBe('A')
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('triggers onClick without calling preventDefault', () => {
      const onClick = jest.fn()
      render(
        <UserItem 
          mode="navigation" 
          user={mockUser} 
          href="/profile/1" 
          onClick={onClick}
        />
      )
      
      const link = screen.getByRole('link')
      fireEvent.click(link)
      
      expect(onClick).toHaveBeenCalled()
      // Note: We can't easily check for default prevented in fireEvent.click without more boilerplate
    })
  })

  describe('Selection Mode', () => {
    it('renders as a button with role="option"', () => {
      const setItemRef = jest.fn().mockReturnValue(() => {})
      render(
        <UserItem 
          mode="selection" 
          user={mockUser} 
          isSelected={false} 
          index={0} 
          setItemRef={setItemRef}
          onClick={() => {}} 
        />
      )
      
      const button = screen.getByRole('option')
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('applies aria-selected when selected', () => {
      const setItemRef = jest.fn().mockReturnValue(() => {})
      render(
        <UserItem 
          mode="selection" 
          user={mockUser} 
          isSelected={true} 
          index={0} 
          setItemRef={setItemRef}
          onClick={() => {}} 
        />
      )
      
      const button = screen.getByRole('option')
      expect(button).toHaveAttribute('aria-selected', 'true')
    })
  })

  describe('Static Mode', () => {
    it('renders as a div when no onClick is provided', () => {
      const { container } = render(
        <UserItem 
          mode="static" 
          user={mockUser} 
        />
      )
      
      const div = container.querySelector('div.block')
      expect(div).not.toBeNull()
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('renders as a button when onClick is provided', () => {
      render(
        <UserItem 
          mode="static" 
          user={mockUser} 
          onClick={() => {}}
        />
      )
      
      const button = screen.getByRole('button')
      expect(button.tagName).toBe('BUTTON')
    })
  })

  describe('Cross-Mode Regressions (Negative Tests)', () => {
    it('does NOT render a link in selection mode', () => {
      const setItemRef = jest.fn().mockReturnValue(() => {})
      render(
        <UserItem 
          mode="selection" 
          user={mockUser} 
          isSelected={false} 
          index={0} 
          setItemRef={setItemRef}
          onClick={() => {}} 
        />
      )
      
      expect(screen.queryByRole('link')).toBeNull()
    })

    it('does NOT render a button in navigation mode', () => {
      render(
        <UserItem 
          mode="navigation" 
          user={mockUser} 
          href="/profile/1" 
        />
      )
      
      expect(screen.queryByRole('button')).toBeNull()
    })
  })
})

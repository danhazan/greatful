"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import UserAvatar from "./UserAvatar"
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

interface ProfileDropdownProps {
  user: {
    id: string | number
    name: string
    displayName?: string
    username: string
    email: string
    profileImageUrl?: string
    image?: string // Still keep for backward compatibility during transition
  }
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onLogout: () => void
}

export default function ProfileDropdown({
  user,
  isOpen,
  onToggle,
  onClose,
  onLogout
}: ProfileDropdownProps) {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Menu items for keyboard navigation
  const menuItems = [
    { label: 'Profile', action: () => handleProfileClick() },
    { label: 'Logout', action: () => handleLogoutClick() }
  ]

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle keyboard navigation with scrolling
  const { setItemRef } = useKeyboardNavigation({
    isOpen,
    itemCount: menuItems.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => {
      menuItems[selectedIndex]?.action()
    },
    onClose,
    scrollBehavior: 'smooth'
  })

  // Reset selected index when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleProfileClick = () => {
    router.push('/profile')
    onClose()
  }

  const handleLogoutClick = () => {
    onLogout()
    onClose()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <UserAvatar
        user={user}
        size="md"
        showTooltip={!isOpen}
        onClick={onToggle}
        className="min-h-[44px] min-w-[44px] touch-manipulation"
      />

      {/* Dropdown Menu - Responsive for both desktop and mobile */}
      {isOpen && (
        <div
          data-profile-dropdown
          className="absolute right-0 top-full mt-2 w-48 sm:w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-w-[calc(100vw-16px)] sm:max-w-[calc(100vw-32px)]"
          style={{
            right: '0',
            left: 'auto',
            // Ensure dropdown doesn't overflow viewport on mobile
            transform: 'translateX(0)',
            maxWidth: 'min(12rem, calc(100vw - 1rem))'
          }}
          role="menu"
          aria-label="Profile menu"
          aria-orientation="vertical"
        >
          {/* User Info Header - Clickable to go to profile */}
          <button
            ref={setItemRef(0)}
            onClick={handleProfileClick}
            onMouseEnter={() => setSelectedIndex(0)}
            role="menuitem"
            className={`w-full px-3 sm:px-4 py-3 border-b border-gray-100 hover:bg-purple-50 active:bg-purple-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset min-h-[44px] touch-manipulation ${selectedIndex === 0 ? 'bg-purple-50' : ''
              }`}
            aria-label="Go to profile page"
          >
            <div className="flex items-center space-x-3">
              <UserAvatar user={user} size="sm" />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-gray-900 truncate hover:text-purple-700 transition-colors">
                  {user.displayName || user.name}
                </p>
                <p className="text-xs text-gray-500 truncate hover:text-purple-600 transition-colors">
                  @{user.username}
                </p>
              </div>
            </div>
          </button>

          {/* Menu Items */}
          <div className="py-1">
            <button
              ref={setItemRef(1)}
              onClick={handleLogoutClick}
              onMouseEnter={() => setSelectedIndex(1)}
              className={`w-full flex items-center px-3 sm:px-4 py-3 sm:py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 active:bg-purple-100 active:text-purple-800 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset min-h-[44px] sm:min-h-auto touch-manipulation ${selectedIndex === 1 ? 'bg-purple-50 text-purple-700' : ''
                }`}
              role="menuitem"
              aria-label="Log out of account"
            >
              <LogOut className="h-4 w-4 mr-3 flex-shrink-0" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
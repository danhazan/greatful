"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { LogOut } from "lucide-react"
import ProfilePhotoDisplay from "./ProfilePhotoDisplay"
import UserAvatar from "./UserAvatar"
import UserItem from "./UserItem"
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
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Menu items for keyboard navigation
  const menuItems = [
    { label: 'Profile', action: () => onClose() },
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

  const handleLogoutClick = () => {
    onLogout()
    onClose()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Avatar Button */}
      <UserAvatar
        user={{
          ...user,
          id: Number(user.id)
        }}
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
          <UserItem
            mode="navigation"
            user={{
              id: Number(user.id),
              username: user.username,
              displayName: user.displayName || user.name,
              profileImageUrl: user.profileImageUrl || user.image,
              email: user.email
            }}
            href="/profile"
            index={0}
            isSelected={selectedIndex === 0}
            setItemRef={setItemRef}
            onMouseEnter={() => setSelectedIndex(0)}
            onClick={onClose}
            className="border-b border-gray-100"
            ariaLabel="Go to profile page"
          />

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
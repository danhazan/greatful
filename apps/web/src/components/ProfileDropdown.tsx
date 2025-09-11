"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, LogOut } from "lucide-react"
import UserAvatar from "./UserAvatar"

interface ProfileDropdownProps {
  user: {
    id: string | number
    name: string
    display_name?: string
    username: string  // Required - all users have usernames
    email: string
    profile_image_url?: string
    profile_photo_filename?: string
    image?: string  // For compatibility with UserContext
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

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

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-w-[calc(100vw-32px)]"
          style={{
            right: '0',
            left: 'auto'
          }}
          role="menu"
          aria-label="Profile menu"
          aria-orientation="vertical"
        >
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <UserAvatar user={user} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.display_name || user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  @{user.username}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={handleProfileClick}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors focus:outline-none focus:bg-purple-50 focus:text-purple-700"
              role="menuitem"
              aria-label="Go to profile page"
            >
              <User className="h-4 w-4 mr-3" aria-hidden="true" />
              Profile
            </button>

            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors focus:outline-none focus:bg-purple-50 focus:text-purple-700"
              role="menuitem"
              aria-label="Log out of account"
            >
              <LogOut className="h-4 w-4 mr-3" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
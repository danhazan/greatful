"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import NotificationSystem from "./NotificationSystem"
import ProfileDropdown from "./ProfileDropdown"
import UserSearchBar from "./UserSearchBar"

interface NavbarProps {
  user?: {
    id: string | number
    name: string
    display_name?: string
    username: string  // Required - all users have usernames
    email: string
    profile_image_url?: string
    profile_photo_filename?: string
  }
  onLogout?: () => void
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const router = useRouter()
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    } else {
      localStorage.removeItem("access_token")
      router.push("/")
    }
    setIsProfileDropdownOpen(false)
  }

  const handleNavigation = (path: string) => {
    router.push(path)
    setIsProfileDropdownOpen(false)
  }

  const handleProfileDropdownToggle = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen)
  }

  const handleProfileDropdownClose = () => {
    setIsProfileDropdownOpen(false)
  }

  return (
    <nav 
      className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 sticky top-0 z-40" 
      role="navigation" 
      aria-label="Main navigation"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4 relative">
        {/* Left section: Logo */}
        <div className="flex items-center flex-shrink-0 relative z-20">
          {user ? (
            <button
              onClick={() => handleNavigation("/feed")}
              className="flex items-center space-x-1 sm:space-x-2 min-h-[44px] hover:opacity-80 active:opacity-70 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md p-1"
              aria-label="Go to Grateful home"
              title="Go to Grateful home"
            >
              {/* Purple heart - always visible, higher z-index */}
              <span className="text-xl sm:text-2xl relative z-30" aria-hidden="true">💜</span>
              {/* Grateful text - can be covered by search on mobile */}
              <h1 className="text-lg sm:text-xl font-bold text-purple-700 whitespace-nowrap select-none relative z-10">Grateful</h1>
            </button>
          ) : (
            <div className="flex items-center space-x-1 sm:space-x-2 min-h-[44px]">
              {/* Purple heart - always visible, higher z-index */}
              <span className="text-xl sm:text-2xl relative z-30" aria-hidden="true">💜</span>
              {/* Grateful text - can be covered by search on mobile */}
              <h1 className="text-lg sm:text-xl font-bold text-purple-700 whitespace-nowrap select-none relative z-10">Grateful</h1>
            </div>
          )}
        </div>
        
        {/* Middle section: Search bar - Responsive layout */}
        {user && (
          <div className="flex-1 min-w-0 max-w-md mx-auto relative overflow-visible">
            {/* Mobile: Collapsible search - positioned to expand leftward over "Grateful" text */}
            <div className="flex sm:hidden justify-end relative overflow-visible">
              <UserSearchBar isMobile={true} className="w-auto relative z-25" />
            </div>
            {/* Desktop: Fixed width centered search bar */}
            <div className="hidden sm:flex justify-center">
              <UserSearchBar placeholder="Search users..." className="w-full max-w-xs" />
            </div>
          </div>
        )}
        
        {/* Right section: Feed icon + Notifications + Profile */}
        <div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0 relative z-20">
          {/* Purple Heart Feed Icon */}
          {user && (
            <button
              onClick={() => handleNavigation("/feed")}
              className="text-purple-600 hover:text-purple-700 active:text-purple-800 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
              aria-label="Go to feed"
              title="Feed"
            >
              <span className="text-xl sm:text-2xl" aria-hidden="true">💜</span>
            </button>
          )}
          
          {user && <NotificationSystem userId={user.id} />}
          
          {/* Profile Dropdown - Responsive for both desktop and mobile */}
          {user && (
            <ProfileDropdown
              user={user}
              isOpen={isProfileDropdownOpen}
              onToggle={handleProfileDropdownToggle}
              onClose={handleProfileDropdownClose}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </nav>
  )
}
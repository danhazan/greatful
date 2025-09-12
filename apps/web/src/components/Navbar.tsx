"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
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
  showBackButton?: boolean
  onLogout?: () => void
}

export default function Navbar({ user, showBackButton = false, onLogout }: NavbarProps) {
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
    <nav className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4" role="navigation" aria-label="Main navigation">
      <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-4">
        {/* Left section: Back button + Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
          <div className="flex items-center space-x-1 sm:space-x-2 min-h-[44px]">
            <span className="text-xl sm:text-2xl" aria-hidden="true">💜</span>
            <h1 className="text-lg sm:text-xl font-bold text-purple-700 whitespace-nowrap">Grateful</h1>
          </div>
        </div>
        
        {/* Middle section: Search bar */}
        {user && (
          <div className="flex-1 min-w-0">
            {/* Mobile: Search that fills available space */}
            <div className="flex sm:hidden">
              <UserSearchBar isMobile={true} className="w-full" />
            </div>
            {/* Desktop: Compact fixed width search bar */}
            <div className="hidden sm:flex justify-center">
              <UserSearchBar placeholder="Search users..." className="w-64" />
            </div>
          </div>
        )}
        
        {/* Right section: Feed icon + Notifications + Profile */}
        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
          {/* Purple Heart Feed Icon */}
          {user && (
            <button
              onClick={() => handleNavigation("/feed")}
              className="text-purple-600 hover:text-purple-700 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
              aria-label="Go to feed"
              title="Feed"
            >
              <span className="text-2xl" aria-hidden="true">💜</span>
            </button>
          )}
          
          {user && <NotificationSystem userId={user.id} />}
          
          {/* Profile Dropdown - Now works on both desktop and mobile */}
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
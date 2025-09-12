"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import NotificationSystem from "./NotificationSystem"
import ProfileDropdown from "./ProfileDropdown"

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
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
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
            <h1 className="text-lg sm:text-xl font-bold text-purple-700 truncate">Grateful</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
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
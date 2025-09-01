"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Menu, X } from "lucide-react"
import NotificationSystem from "./NotificationSystem"

interface NavbarProps {
  user?: {
    id: string | number
    name: string
    email: string
  }
  showBackButton?: boolean
  onLogout?: () => void
}

export default function Navbar({ user, showBackButton = false, onLogout }: NavbarProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    } else {
      localStorage.removeItem("access_token")
      router.push("/")
    }
    setIsMobileMenuOpen(false)
  }

  const handleNavigation = (path: string) => {
    router.push(path)
    setIsMobileMenuOpen(false)
  }

  return (
    <>
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
            <button 
              onClick={() => handleNavigation("/feed")}
              className="flex items-center space-x-1 sm:space-x-2 hover:opacity-80 transition-opacity min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
              aria-label="Go to Grateful home page"
            >
              <span className="text-xl sm:text-2xl" aria-hidden="true">💜</span>
              <h1 className="text-lg sm:text-xl font-bold text-purple-700 truncate">Grateful</h1>
            </button>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-4 min-w-0">
            {user && (
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
                Welcome, {user.name}!
              </span>
            )}
            {user && <NotificationSystem userId={user.id} />}
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center space-x-4" role="menubar" aria-label="Main menu">
              <button
                onClick={() => handleNavigation("/feed")}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium px-2 py-2 min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                role="menuitem"
                aria-label="Go to feed page"
              >
                Feed
              </button>
              <button
                onClick={() => handleNavigation("/profile")}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium px-2 py-2 min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                role="menuitem"
                aria-label="Go to profile page"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium px-2 py-2 min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
                role="menuitem"
                aria-label="Log out of account"
              >
                Logout
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden text-gray-600 hover:text-gray-900 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-md"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-haspopup="true"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black bg-opacity-25 z-40 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div 
            className="fixed top-[73px] right-0 left-0 bg-white border-b border-gray-200 shadow-lg z-50 sm:hidden"
            role="menu"
            aria-label="Mobile navigation menu"
          >
            <div className="px-4 py-2 space-y-1">
              <button
                onClick={() => handleNavigation("/feed")}
                className="w-full text-left px-3 py-3 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                role="menuitem"
                aria-label="Go to feed page"
              >
                Feed
              </button>
              <button
                onClick={() => handleNavigation("/profile")}
                className="w-full text-left px-3 py-3 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                role="menuitem"
                aria-label="Go to profile page"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-3 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors min-h-[44px] touch-manipulation focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                role="menuitem"
                aria-label="Log out of account"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
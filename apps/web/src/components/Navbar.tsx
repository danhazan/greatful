"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import NotificationSystem from "./NotificationSystem"

interface NavbarProps {
  user?: {
    id: number
    name: string
    email: string
  }
  showBackButton?: boolean
  onLogout?: () => void
}

export default function Navbar({ user, showBackButton = false, onLogout }: NavbarProps) {
  const router = useRouter()

  const handleLogout = () => {
    if (onLogout) {
      onLogout()
    } else {
      localStorage.removeItem("access_token")
      router.push("/")
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {showBackButton && (
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          )}
          <button 
            onClick={() => router.push("/feed")}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">💜</span>
            <h1 className="text-xl font-bold text-purple-700">Grateful</h1>
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          {user && (
            <span className="text-sm text-gray-600">Welcome, {user.name}!</span>
          )}
          {user && <NotificationSystem userId={user.id} />}
          <button
            onClick={() => router.push("/feed")}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Feed
          </button>
          <button
            onClick={() => router.push("/profile")}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Profile
          </button>
          <button
            onClick={handleLogout}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
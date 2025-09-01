'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SinglePostView from '@/components/SinglePostView'
import Navbar from '@/components/Navbar'

interface PostPageProps {
  params: {
    id: string
  }
}

export default function PostPage({ params }: PostPageProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    // Get user info from API
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const userData = await response.json()
          // Handle both wrapped and unwrapped responses
          const profileData = userData.data || userData
          const currentUser = {
            id: profileData.id,
            name: profileData.display_name || profileData.username,
            email: profileData.email
          }
          setUser(currentUser)
        } else {
          // Check if it's an auth error
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("access_token")
            router.push("/auth/login")
            return
          }
          throw new Error('Failed to fetch user info')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        // Redirect to login on auth failure
        localStorage.removeItem("access_token")
        router.push("/auth/login")
        return
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserInfo()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setUser(null)
    router.push("/")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gratitude Post</h1>
            <p className="text-gray-600">View and interact with this gratitude post</p>
          </div>
          
          {/* Single post display */}
          <div className="bg-white rounded-lg shadow-sm">
            <SinglePostView postId={params.id} />
          </div>
          
          {/* Back to feed link */}
          <div className="mt-6 text-center">
            <a 
              href="/feed" 
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              ← Back to Feed
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
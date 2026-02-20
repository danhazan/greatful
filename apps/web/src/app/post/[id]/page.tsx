'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SinglePostView from '@/components/SinglePostView'
import Navbar from '@/components/Navbar'
import { useUser } from '@/contexts/UserContext'

interface PostPageProps {
  params: {
    id: string
  }
}

export default function PostPage({ params }: PostPageProps) {
  const router = useRouter()
  const { currentUser, isLoading, logout } = useUser()

  // Convert UserContext user to the format expected by Navbar
  const user = currentUser ? {
    id: currentUser.id,
    name: currentUser.displayName || currentUser.name,
    displayName: currentUser.displayName,
    username: currentUser.username,
    email: currentUser.email,
    profileImageUrl: currentUser.profileImageUrl
  } : undefined

  const handleLogout = () => {
    // Use centralized logout from UserContext (handles token removal, notification cleanup, etc.)
    logout()
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
          {/* Single post display */}
          <div className="bg-white rounded-lg shadow-sm">
            <SinglePostView postId={params.id} />
          </div>

          {/* Back to feed/home link */}
          <div className="mt-6 text-center">
            <a
              href={user ? "/feed" : "/"}
              className="text-purple-600 hover:text-purple-700 font-medium"
            >
              ← Back to {user ? "Feed" : "Home"}
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
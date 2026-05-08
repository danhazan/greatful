'use client'

import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import SinglePostView from '@/components/SinglePostView'
import { useUser } from '@/contexts/UserContext'
import { Post } from '@/types/post'

interface PostPageClientProps {
  postId: string
  bootstrapPost: Post | null
}

export default function PostPageClient({ postId, bootstrapPost }: PostPageClientProps) {
  const router = useRouter()
  const { currentUser, isLoading, logout } = useUser()

  const user = currentUser ? {
    id: currentUser.id,
    name: currentUser.displayName || currentUser.name,
    displayName: currentUser.displayName,
    username: currentUser.username,
    email: currentUser.email,
    profileImageUrl: currentUser.profileImageUrl
  } : undefined

  const handleLogout = () => {
    logout()
    router.push('/')
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
      <Navbar user={user} onLogout={handleLogout} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm">
            <SinglePostView postId={postId} bootstrapPost={bootstrapPost} />
          </div>
        </div>
      </main>
    </div>
  )
}

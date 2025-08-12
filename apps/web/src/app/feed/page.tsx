"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart, Plus } from "lucide-react"
import PostCard from "@/components/PostCard"

// Mock data for now - will be replaced with real API calls
const mockPosts = [
  {
    id: "feed-1",
    content: "I'm grateful for this beautiful morning and the opportunity to connect with amazing people through this platform! 🌅",
    author: {
      id: "user-1",
      name: "Sarah Johnson",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date().toISOString(),
    postType: "daily" as const,
    heartsCount: 12,
    isHearted: false,
    reactionsCount: 8,
    currentUserReaction: undefined
  },
  {
    id: "feed-2", 
    content: "Grateful for my morning coffee ritual and the quiet moments before the day begins ☕",
    author: {
      id: "user-2",
      name: "Mike Chen",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
    postType: "photo" as const,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop",
    heartsCount: 24,
    isHearted: true,
    reactionsCount: 15,
    currentUserReaction: "heart_eyes"
  },
  {
    id: "feed-3",
    content: "Quick gratitude for my team's support during today's presentation! 🙏",
    author: {
      id: "user-3", 
      name: "Emma Wilson",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    postType: "spontaneous" as const,
    heartsCount: 8,
    isHearted: false,
    reactionsCount: 3,
    currentUserReaction: undefined
  }
]

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState(mockPosts)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Check authentication and load user data
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    // TODO: Validate token and get user info
    // For now, set a mock user
    setUser({
      id: "current-user",
      name: "You",
      email: "user@example.com"
    })
    
    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    router.push("/")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          heartsCount: isCurrentlyHearted ? (post.heartsCount || 1) - 1 : (post.heartsCount || 0) + 1,
          isHearted: !isCurrentlyHearted
        }
      }
      return post
    }))
  }

  const handleReaction = (postId: string, emojiCode: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const wasReacted = !!post.currentUserReaction
        return {
          ...post,
          reactionsCount: wasReacted ? post.reactionsCount || 1 : (post.reactionsCount || 0) + 1,
          currentUserReaction: emojiCode
        }
      }
      return post
    }))
  }

  const handleRemoveReaction = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: Math.max(0, (post.reactionsCount || 1) - 1),
          currentUserReaction: undefined
        }
      }
      return post
    }))
  }

  const handleShare = (postId: string) => {
    alert(`Share functionality for post ${postId} - Coming in TASK 3!`)
  }

  const handleUserClick = (userId: string) => {
    alert(`Navigate to user profile: ${userId} - Coming soon!`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your gratitude feed...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">💜</span>
            <h1 className="text-xl font-bold text-purple-700">Grateful</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.name}!</span>
            <button
              onClick={handleLogout}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Welcome Message */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-purple-900 mb-2">
              🎉 Welcome to your Gratitude Feed!
            </h2>
            <p className="text-purple-800">
              You can now interact with posts using emoji reactions! Click the 😊+ button to react with positive emotions.
            </p>
          </div>

          {/* Posts */}
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onHeart={handleHeart}
                onReaction={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                onShare={handleShare}
                onUserClick={handleUserClick}
              />
            ))}
          </div>

          {/* Floating Create Post Button */}
          <div className="fixed bottom-6 right-6">
            <button
              onClick={() => alert("Post creation coming in TASK 2!")}
              className="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110"
              title="Create New Post"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Heart } from "lucide-react"
import PostCard from "@/components/PostCard"

// Mock data for demo
const mockPosts = [
  {
    id: "demo-1",
    content: "I'm grateful for this beautiful sunny morning and the opportunity to test our new emoji reaction system! 🌅",
    author: {
      id: "user-1",
      name: "Demo User",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date().toISOString(),
    postType: "daily" as const,
    heartsCount: 5,
    isHearted: false,
    reactionsCount: 3,
    currentUserReaction: undefined
  },
  {
    id: "demo-2", 
    content: "Grateful for my morning coffee and the chance to build something amazing! ☕",
    author: {
      id: "user-2",
      name: "Coffee Lover",
      image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    postType: "photo" as const,
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop",
    heartsCount: 12,
    isHearted: true,
    reactionsCount: 8,
    currentUserReaction: "heart_eyes"
  },
  {
    id: "demo-3",
    content: "Quick gratitude for my team's support today! 🙏",
    author: {
      id: "user-3", 
      name: "Team Player",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
    },
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    postType: "spontaneous" as const,
    heartsCount: 3,
    isHearted: false,
    reactionsCount: 1,
    currentUserReaction: undefined
  }
]

export default function DemoPage() {
  const router = useRouter()
  const [posts, setPosts] = useState(mockPosts)

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
          currentUserReaction: emojiCode as string | undefined
        }
      }
      return post
    }) as typeof posts)
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
    }) as typeof posts)
  }

  const handleShare = (postId: string) => {
    alert(`Share functionality for post ${postId} - This will open the share modal in the full app!`)
  }

  const handleUserClick = (userId: string) => {
    alert(`Navigate to user profile: ${userId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Home</span>
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="text-2xl">💜</span>
            <h1 className="text-xl font-bold text-purple-700">Grateful Demo</h1>
          </div>
          
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Demo Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Demo Instructions */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-purple-900 mb-3">
              🎉 Emoji Reactions Demo
            </h2>
            <div className="text-purple-800 space-y-2">
              <p>• Click the <strong>😊+</strong> button to open the emoji picker</p>
              <p>• Choose from 8 positive emotions: 😍 🤗 🙏 💪 🌟 🔥 🥰 👏</p>
              <p>• Click reaction counts to see who reacted (simulated)</p>
              <p>• Notice the visual hierarchy: Daily posts are larger, photo posts medium, spontaneous compact</p>
              <p>• Use keyboard shortcuts 1-8 when emoji picker is open</p>
            </div>
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

          {/* Demo Footer */}
          <div className="mt-12 text-center">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ready to join Grateful?
              </h3>
              <p className="text-gray-600 mb-4">
                Create your account to start sharing your daily gratitude and connect with others!
              </p>
              <div className="flex space-x-4 justify-center">
                <button
                  onClick={() => router.push("/auth/signup")}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                >
                  Sign Up
                </button>
                <button
                  onClick={() => router.push("/auth/login")}
                  className="bg-purple-100 text-purple-700 px-6 py-2 rounded-lg font-semibold hover:bg-purple-200 transition-colors"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
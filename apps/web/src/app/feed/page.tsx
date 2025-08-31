"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart, Plus } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"

import Navbar from "@/components/Navbar"

// No mock data - use real API data exclusively

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [selectedPost, setSelectedPost] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Load posts from API - server is authoritative for all data
  const loadPosts = async (token: string) => {
    try {
      setError(null)
      const response = await fetch('/api/posts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`Failed to load posts: ${response.status} - ${errorText}`)
      }

      const postsData = await response.json()

      if (!Array.isArray(postsData)) {
        throw new Error('Invalid posts data format')
      }

      // The API already returns the correct format, just use it directly
      setPosts(postsData)
    } catch (error) {
      console.error('Error loading posts:', error)
      setError(error instanceof Error ? error.message : 'Failed to load posts')
      setPosts([]) // Set empty array on error
    }
  }

  // Check authentication and load user data
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
          const currentUser = {
            id: userData.id,
            name: userData.username,
            email: userData.email
          }
          setUser(currentUser)
        } else {
          throw new Error('Failed to fetch user info')
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        setError('Failed to load user information')
        // Redirect to login on auth failure
        router.push("/auth/login")
        return
      }
    }

    const initializePage = async () => {
      await fetchUserInfo()
      await loadPosts(token)
      setIsLoading(false)
    }

    initializePage()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setUser(null)
    setPosts([])
    router.push("/")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => {
    // Update post state with server response data
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          heartsCount: heartInfo ? heartInfo.hearts_count : (isCurrentlyHearted ? post.heartsCount - 1 : post.heartsCount + 1),
          isHearted: heartInfo ? heartInfo.is_hearted : !isCurrentlyHearted
        }
      }
      return post
    }))
  }

  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    // Update post state with server response data
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: reactionSummary ? reactionSummary.total_count : post.reactionsCount + 1,
          currentUserReaction: reactionSummary ? reactionSummary.user_reaction : emojiCode
        }
      }
      return post
    }) as typeof posts)
  }

  const handleRemoveReaction = async (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    // Update post state with server response data
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: reactionSummary ? reactionSummary.total_count : Math.max(post.reactionsCount - 1, 0),
          currentUserReaction: reactionSummary ? reactionSummary.user_reaction : undefined
        }
      }
      return post
    }) as typeof posts)
  }

  const handleShare = (postId: string) => {
    // Share handling is now managed by PostCard's internal ShareModal
    // This callback can be used for analytics or other side effects
    console.log('Post shared:', postId)
  }

  const handleUserClick = (userId: string) => {
    if (userId === "current-user" || userId === user?.id) {
      router.push("/profile")
    } else {
      // Navigate to specific user's profile
      router.push(`/profile/${userId}`)
    }
  }

  const refreshPosts = async () => {
    const token = localStorage.getItem("access_token")
    if (token) {
      await loadPosts(token)
    }
  }

  const handleCreatePost = async (postData: {
    content: string
    postType: 'daily' | 'photo' | 'spontaneous'
    imageUrl?: string
    location?: string
    imageFile?: File  // Add support for actual file
  }) => {
    setIsCreatingPost(true)
    
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      let response: Response

      // If there's an image file, send as FormData to the upload endpoint
      if (postData.imageFile) {
        const formData = new FormData()
        formData.append('content', postData.content.trim())
        formData.append('post_type', postData.postType)
        if (postData.location) formData.append('location', postData.location)
        formData.append('image', postData.imageFile)

        response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type for FormData
          },
          body: formData
        })
      } else {
        // Send as JSON if no image
        response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            content: postData.content.trim(),
            postType: postData.postType,
            imageUrl: postData.imageUrl,
            location: postData.location
          })
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create post')
      }

      // Refresh the entire feed to get the latest data
      await refreshPosts()
      
      // Close the modal
      setIsCreateModalOpen(false)
      
    } catch (error) {
      console.error('Error creating post:', error)
      // The error will be handled by the CreatePostModal component
      throw error
    } finally {
      setIsCreatingPost(false)
    }
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Feed</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-semibold text-purple-900 mb-2">
              🎉 Welcome to your Gratitude Feed!
            </h2>
            <p className="text-sm sm:text-base text-purple-800">
              Share your gratitude and connect with others! Heart posts you love and react with positive emotions. 
              All your interactions are synced across devices.
            </p>
          </div>

          {/* Posts */}
          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-600 mb-4">Be the first to share your gratitude!</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  Create Your First Post
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id?.toString()}
                  onHeart={handleHeart}
                  onReaction={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onShare={handleShare}
                  onUserClick={handleUserClick}
                />
              ))
            )}
          </div>

          {/* Floating Create Post Button */}
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
              title="Create New Post"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {/* Create Post Modal */}
          <CreatePostModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSubmit={handleCreatePost}
          />


        </div>
      </main>
    </div>
  )
}
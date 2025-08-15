"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart, Plus } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"
import NotificationSystem from "@/components/NotificationSystem"
import { loadUserReactions, saveUserReactions, clearGenericReactionData } from "@/utils/localStorage"

// Mock data for now - will be replaced with real API calls
// Global counts represent reactions from ALL users, individual state comes from localStorage
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
    heartsCount: 12, // Global count from all users
    reactionsCount: 8, // Global count from all users
    // Individual user state will be loaded from localStorage
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
    heartsCount: 24, // Global count from all users
    reactionsCount: 15, // Global count from all users
    // Individual user state will be loaded from localStorage
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
    heartsCount: 8, // Global count from all users
    reactionsCount: 3, // Global count from all users
    // Individual user state will be loaded from localStorage
  }
]

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState(mockPosts)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [localReactions, setLocalReactions] = useState<{[postId: string]: {reaction?: string, hearted?: boolean}}>({})

  // Clear any old generic reaction data that might cause cross-user sharing
  useEffect(() => {
    clearGenericReactionData()
  }, [])

  // Save user-specific reactions to localStorage
  const saveLocalReactions = (reactions: {[postId: string]: {reaction?: string, hearted?: boolean}}) => {
    setLocalReactions(reactions)
    if (user?.id) {
      saveUserReactions(user.id, reactions)
      if (process.env.NODE_ENV === 'development') {
        console.debug('Saved user-specific reactions for user', user.id, ':', reactions)
      }
    }
  }

  // Load posts from API and merge with user-specific reaction data
  const loadPostsWithReactions = async (token: string, reactions: {[postId: string]: {reaction?: string, hearted?: boolean}}) => {
    try {
      const response = await fetch('/api/posts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      let postsData = mockPosts
      if (response.ok) {
        postsData = await response.json()
      } else if (process.env.NODE_ENV === 'development') {
        console.debug('Failed to load posts from API, using mock data')
      }

      // For each post, merge with user-specific reaction data
      // Global counts show totals from all users, individual state shows current user's reactions
      const postsWithUserReactions = postsData.map((post: any) => {
        // Check user-specific local storage for this user's reaction data
        const localData = reactions[post.id]
        
        return {
          ...post,
          // Keep global counts from server (these represent all users' reactions)
          heartsCount: post.heartsCount || 0,
          reactionsCount: post.reactionsCount || 0,
          
          // User-specific state from local storage (what THIS user has done)
          currentUserReaction: localData?.reaction || undefined,
          isHearted: localData?.hearted ?? false,
        }
      })

      setPosts(postsWithUserReactions)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Error loading posts:', error)
      }
      // Fallback to mock data with user-specific reactions
      const mergedPosts = mockPosts.map((post: any) => {
        const localData = reactions[post.id]
        return {
          ...post,
          // Keep global counts from mock data (representing all users)
          heartsCount: post.heartsCount || 0,
          reactionsCount: post.reactionsCount || 0,
          
          // User-specific state from local storage
          currentUserReaction: localData?.reaction || undefined,
          isHearted: localData?.hearted ?? false,
        }
      })
      setPosts(mergedPosts)
    }
  }

  // Check authentication and load user data
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    // Load user-specific reactions first (will be empty until user is loaded)
    let loadedReactions = {}

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
            id: userData.id.toString(),
            name: userData.username,
            email: userData.email
          }
          setUser(currentUser)
          
          // Load user-specific reactions after user is set
          const userReactions = loadUserReactions(currentUser.id)
          setLocalReactions(userReactions)
          loadedReactions = userReactions
          
          if (process.env.NODE_ENV === 'development') {
            console.debug('Loaded user-specific reactions for user', currentUser.id, ':', userReactions)
          }
        } else {
          // Fallback to mock user if API fails
          const mockUser = {
            id: "current-user",
            name: "You",
            email: "user@example.com"
          }
          setUser(mockUser)
          
          // Load user-specific reactions for mock user
          const userReactions = loadUserReactions(mockUser.id)
          setLocalReactions(userReactions)
          loadedReactions = userReactions
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
        // Fallback to mock user
        const mockUser = {
          id: "current-user",
          name: "You",
          email: "user@example.com"
        }
        setUser(mockUser)
        
        // Load user-specific reactions for mock user
        const userReactions = loadUserReactions(mockUser.id)
        setLocalReactions(userReactions)
        loadedReactions = userReactions
      }
    }

    const initializePage = async () => {
      await fetchUserInfo()
      await loadPostsWithReactions(token, loadedReactions)
      setIsLoading(false)
    }

    initializePage()
  }, [router])

  const handleLogout = () => {
    // Clear user-specific data when logging out
    if (user?.id) {
      // Note: We don't clear user reactions on logout to preserve them for next login
      // Only clear session-specific data
      if (process.env.NODE_ENV === 'development') {
        console.debug('Logging out user:', user.id)
      }
    }
    
    localStorage.removeItem("access_token")
    setLocalReactions({}) // Clear in-memory reactions
    setUser(null) // Clear user state
    router.push("/")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean) => {
    const newHearted = !isCurrentlyHearted
    
    // Update ONLY the user's individual heart state - keep global counts unchanged
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Keep global count unchanged (server-authoritative)
          heartsCount: post.heartsCount,
          // Update only user's individual heart state
          isHearted: newHearted
        }
      }
      return post
    }))

    // Save user's individual reaction state to local storage
    const newLocalReactions = {
      ...localReactions,
      [postId]: {
        ...localReactions[postId],
        hearted: newHearted
      }
    }
    saveLocalReactions(newLocalReactions)
  }

  const handleReaction = async (postId: string, emojiCode: string) => {
    // Update ONLY the user's individual reaction state - keep global counts unchanged
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Keep global count unchanged (server-authoritative)
          reactionsCount: post.reactionsCount,
          // Update only user's individual reaction state
          currentUserReaction: emojiCode as string | undefined
        }
      }
      return post
    }) as typeof posts)

    // Save user's individual reaction state to local storage
    const newLocalReactions = {
      ...localReactions,
      [postId]: {
        ...localReactions[postId],
        reaction: emojiCode
      }
    }
    saveLocalReactions(newLocalReactions)

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      const response = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ emojiCode })
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for reaction, but local state updated')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for reaction sync:', error)
      }
    }
  }

  const handleRemoveReaction = async (postId: string) => {
    // Update ONLY the user's individual reaction state - keep global counts unchanged
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Keep global count unchanged (server-authoritative)
          reactionsCount: post.reactionsCount,
          // Clear only user's individual reaction state
          currentUserReaction: undefined
        }
      }
      return post
    }) as typeof posts)

    // Save user's individual reaction state to local storage
    const newLocalReactions = {
      ...localReactions,
      [postId]: {
        ...localReactions[postId],
        reaction: undefined
      }
    }
    saveLocalReactions(newLocalReactions)

    // Try to sync with backend, but don't block UI if it fails
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      const response = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok && process.env.NODE_ENV === 'development') {
        console.debug('Backend sync failed for reaction removal, but local state updated')
      }
    } catch (error) {
      // Silently handle errors - local state is already updated
      if (process.env.NODE_ENV === 'development') {
        console.debug('Backend unavailable for reaction removal sync:', error)
      }
    }
  }

  const handleShare = (postId: string) => {
    alert(`Share functionality for post ${postId} - Coming in TASK 3!`)
  }

  const handleUserClick = (userId: string) => {
    if (userId === "current-user" || userId === user?.id) {
      router.push("/profile")
    } else {
      // Navigate to specific user's profile
      router.push(`/profile/${userId}`)
    }
  }

  const handleCreatePost = async (postData: {
    content: string
    postType: 'daily' | 'photo' | 'spontaneous'
    imageUrl?: string
    location?: string
  }) => {
    setIsCreatingPost(true)
    
    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create post')
      }

      const newPost = await response.json()
      
      // Add the new post to the beginning of the posts array
      setPosts(prevPosts => [newPost, ...prevPosts])
      
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button 
            onClick={() => router.push("/feed")}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-2xl">💜</span>
            <h1 className="text-xl font-bold text-purple-700">Grateful</h1>
          </button>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, {user?.name}!</span>
            {user && <NotificationSystem userId={user.id} />}
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
              The counts show the total reactions from all users (server data), while your personal reactions are saved privately and highlighted.
            </p>
          </div>

          {/* Posts */}
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id}
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
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110"
              title="Create New Post"
            >
              <Plus className="h-6 w-6" />
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
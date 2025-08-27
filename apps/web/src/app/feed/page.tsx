"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Heart, Plus } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"
import Navbar from "@/components/Navbar"
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
      saveUserReactions(user.id.toString(), reactions)
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
            id: userData.id, // Keep as integer, don't convert to string
            name: userData.username,
            email: userData.email
          }
          setUser(currentUser)
          
          // Load user-specific reactions after user is set
          const userReactions = loadUserReactions(currentUser.id.toString())
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

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newHearted = heartInfo ? heartInfo.is_hearted : !isCurrentlyHearted
    const newCount = heartInfo ? heartInfo.hearts_count : (isCurrentlyHearted ? (posts.find(p => p.id === postId)?.heartsCount || 1) - 1 : (posts.find(p => p.id === postId)?.heartsCount || 0) + 1)
    
    // Update both the user's individual heart state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          heartsCount: newCount,
          // Update user's individual heart state
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

  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newReaction = reactionSummary ? reactionSummary.user_reaction : emojiCode
    const newCount = reactionSummary ? reactionSummary.total_count : (posts.find(p => p.id === postId)?.reactionsCount || 0) + 1
    
    // Update both the user's individual reaction state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          reactionsCount: newCount,
          // Update user's individual reaction state
          currentUserReaction: newReaction as string | undefined
        }
      }
      return post
    }) as typeof posts)

    // Save user's individual reaction state to local storage
    const newLocalReactions = {
      ...localReactions,
      [postId]: {
        ...localReactions[postId],
        reaction: newReaction || undefined
      }
    }
    saveLocalReactions(newLocalReactions)
  }

  const handleRemoveReaction = async (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newReaction = reactionSummary ? reactionSummary.user_reaction : undefined
    const newCount = reactionSummary ? reactionSummary.total_count : Math.max((posts.find(p => p.id === postId)?.reactionsCount || 1) - 1, 0)
    
    // Update both the user's individual reaction state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          reactionsCount: newCount,
          // Clear user's individual reaction state
          currentUserReaction: newReaction as string | undefined
        }
      }
      return post
    }) as typeof posts)

    // Save user's individual reaction state to local storage
    const newLocalReactions = {
      ...localReactions,
      [postId]: {
        ...localReactions[postId],
        reaction: newReaction || undefined
      }
    }
    saveLocalReactions(newLocalReactions)
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
      <Navbar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
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
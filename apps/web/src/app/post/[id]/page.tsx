"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import PostCard from '@/components/PostCard'
import Navbar from '@/components/Navbar'
import { loadUserReactions, saveUserReactions } from '@/utils/localStorage'
import { useUser } from '@/contexts/UserContext'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Post {
  id: string
  content: string
  title?: string
  author: {
    id: string
    name: string
    username?: string
    image?: string
  }
  createdAt: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
}

interface PageProps {
  params: { id: string }
}

// Landing page navbar for unauthenticated users
function LandingNavbar() {
  const router = useRouter()
  
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">💜</span>
          <h1 className="text-xl font-bold text-gray-900">Grateful</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Shared gratitude post</span>
          <button
            onClick={() => router.push("/auth/login")}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            Log In
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Sign Up
          </button>
        </div>
      </div>
    </nav>
  )
}

export default function PostPage({ params }: PageProps) {
  const router = useRouter()
  const { currentUser, isLoading: userLoading } = useUser()
  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [localReactions, setLocalReactions] = useState<{[postId: string]: {reaction?: string, hearted?: boolean}}>({})

  // Fetch post data
  const fetchPost = async (token?: string) => {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/posts/${params.id}`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        if (response.status === 404) {
          notFound()
        }
        throw new Error('Failed to fetch post')
      }

      const postData = await response.json()

      // Transform the post to match the frontend format
      const transformedPost: Post = {
        id: postData.id,
        content: postData.content,
        title: postData.title,
        author: {
          id: postData.author.id.toString(),
          name: postData.author.name || postData.author.username,
          username: postData.author.username,
          image: postData.author.profile_image_url
        },
        createdAt: postData.created_at,
        postType: postData.post_type,
        imageUrl: postData.image_url,
        location: postData.location,
        heartsCount: postData.hearts_count || 0,
        isHearted: postData.is_hearted || false,
        reactionsCount: postData.reactions_count || 0,
        currentUserReaction: postData.current_user_reaction || undefined
      }

      return transformedPost
    } catch (error) {
      console.error('Error fetching post:', error)
      return null
    }
  }

  // Load post data when user context is ready
  useEffect(() => {
    const loadPost = async () => {
      if (userLoading) return // Wait for user context to load

      const token = localStorage.getItem("access_token")
      
      if (currentUser && token) {
        // User is authenticated - load user-specific reactions and post data
        const userReactions = loadUserReactions(currentUser.id.toString())
        setLocalReactions(userReactions)

        // Fetch post with authentication
        const postData = await fetchPost(token)
        if (postData) {
          // Merge with local reactions
          const localData = userReactions[postData.id]
          setPost({
            ...postData,
            isHearted: localData?.hearted ?? postData.isHearted,
            currentUserReaction: localData?.reaction ?? postData.currentUserReaction
          })
        }
      } else {
        // User is not authenticated - load post without user-specific data
        const postData = await fetchPost()
        setPost(postData)
      }

      setIsLoading(false)
    }

    loadPost()
  }, [params.id, currentUser, userLoading])

  // Save user-specific reactions to localStorage
  const saveLocalReactions = (reactions: {[postId: string]: {reaction?: string, hearted?: boolean}}) => {
    setLocalReactions(reactions)
    if (currentUser?.id) {
      saveUserReactions(currentUser.id.toString(), reactions)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    setLocalReactions({})
    router.push("/")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    if (!post) return

    const newHearted = heartInfo ? heartInfo.is_hearted : !isCurrentlyHearted
    const newCount = heartInfo ? heartInfo.hearts_count : (isCurrentlyHearted ? (post.heartsCount || 1) - 1 : (post.heartsCount || 0) + 1)
    
    setPost({
      ...post,
      heartsCount: newCount,
      isHearted: newHearted
    })

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
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    if (!post) return

    const newReaction = reactionSummary ? reactionSummary.user_reaction : emojiCode
    const newCount = reactionSummary ? reactionSummary.total_count : (post.reactionsCount || 0) + 1
    
    setPost({
      ...post,
      reactionsCount: newCount,
      currentUserReaction: newReaction as string | undefined
    })

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
    if (!currentUser) {
      router.push('/auth/login')
      return
    }

    if (!post) return

    const newReaction = reactionSummary ? reactionSummary.user_reaction : undefined
    const newCount = reactionSummary ? reactionSummary.total_count : Math.max((post.reactionsCount || 1) - 1, 0)
    
    setPost({
      ...post,
      reactionsCount: newCount,
      currentUserReaction: newReaction as string | undefined
    })

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
    console.log('Post shared:', postId)
  }

  const handleUserClick = (userId: string) => {
    if (currentUser) {
      if (userId === currentUser.id?.toString()) {
        router.push("/profile")
      } else {
        router.push(`/profile/${userId}`)
      }
    } else {
      // For unauthenticated users, redirect to login
      router.push('/auth/login')
    }
  }

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading post...</p>
        </div>
      </div>
    )
  }

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar - different based on authentication */}
      {currentUser ? (
        <Navbar user={currentUser} onLogout={handleLogout} />
      ) : (
        <LandingNavbar />
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* For authenticated users, show post like in feed */}
          {currentUser ? (
            <div className="space-y-6">
              <PostCard
                post={post}
                currentUserId={currentUser?.id}
                onHeart={handleHeart}
                onReaction={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                onShare={handleShare}
                onUserClick={handleUserClick}
              />
            </div>
          ) : (
            /* For unauthenticated users, show locked post with call to action */
            <>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
                <PostCard
                  post={post}
                  currentUserId={undefined}
                  onHeart={handleHeart}
                  onReaction={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onShare={handleShare}
                  onUserClick={handleUserClick}
                />
              </div>

              {/* Call to Action for unauthenticated users */}
              <div className="text-center">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Join the Grateful Community
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Share your own gratitude and connect with others spreading positivity.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => router.push("/auth/signup")}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
                    >
                      Sign Up
                    </button>
                    <button
                      onClick={() => router.push("/auth/login")}
                      className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Log In
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer for unauthenticated users */}
      {!currentUser && (
        <footer className="bg-white border-t border-gray-200 mt-12">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="text-center text-sm text-gray-600">
              <p>© 2025 Grateful. Spreading positivity, one gratitude at a time.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import PostCard from "./PostCard"
import { isAuthenticated, getAccessToken } from "@/utils/auth"

interface Post {
  id: string
  content: string
  author: {
    id: string
    name: string
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

interface SharedPostWrapperProps {
  post: Post
}

export default function SharedPostWrapper({ post: initialPost }: SharedPostWrapperProps) {
  const router = useRouter()
  const [post, setPost] = useState(initialPost)
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false)

  // Check authentication status and fetch user-specific data
  useEffect(() => {
    const checkAuthAndFetchUserData = async () => {
      const authenticated = isAuthenticated()
      setIsUserAuthenticated(authenticated)

      if (authenticated) {
        try {
          const token = getAccessToken()
          
          // Fetch user profile to get current user ID
          const userResponse = await fetch('/api/users/me/profile', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (userResponse.ok) {
            const userData = await userResponse.json()
            setCurrentUserId(userData.id?.toString())

            // Fetch user-specific post data (hearts and reactions)
            const postResponse = await fetch(`/api/posts/${post.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })

            if (postResponse.ok) {
              const postData = await postResponse.json()
              
              // Update post with user-specific data
              setPost(prevPost => ({
                ...prevPost,
                isHearted: postData.is_hearted || false,
                currentUserReaction: postData.current_user_reaction || undefined,
                heartsCount: postData.hearts_count || prevPost.heartsCount || 0,
                reactionsCount: postData.reactions_count || prevPost.reactionsCount || 0,
              }))
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          // If there's an error, treat as unauthenticated
          setIsUserAuthenticated(false)
          setCurrentUserId(undefined)
        }
      }
    }

    checkAuthAndFetchUserData()
  }, [post.id])

  // Handle heart interaction
  const handleHeart = async (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => {
    if (!isUserAuthenticated) {
      // Redirect to login if not authenticated
      router.push('/auth/login')
      return
    }

    // Update post state with server response or optimistic update
    if (heartInfo) {
      setPost(prevPost => ({
        ...prevPost,
        heartsCount: heartInfo.hearts_count,
        isHearted: heartInfo.is_hearted,
      }))
    } else {
      // Fallback optimistic update
      setPost(prevPost => ({
        ...prevPost,
        heartsCount: (prevPost.heartsCount || 0) + (isCurrentlyHearted ? -1 : 1),
        isHearted: !isCurrentlyHearted,
      }))
    }
  }

  // Handle reaction interaction
  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    if (!isUserAuthenticated) {
      // Redirect to login if not authenticated
      router.push('/auth/login')
      return
    }

    // Update post state with server response or optimistic update
    if (reactionSummary) {
      setPost(prevPost => ({
        ...prevPost,
        reactionsCount: reactionSummary.total_count,
        currentUserReaction: reactionSummary.user_reaction || undefined,
      }))
    } else {
      // Fallback optimistic update
      const wasReacting = !!post.currentUserReaction
      setPost(prevPost => ({
        ...prevPost,
        reactionsCount: (prevPost.reactionsCount || 0) + (wasReacting ? 0 : 1),
        currentUserReaction: emojiCode,
      }))
    }
  }

  // Handle reaction removal
  const handleRemoveReaction = async (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
    if (!isUserAuthenticated) {
      // Redirect to login if not authenticated
      router.push('/auth/login')
      return
    }

    // Update post state with server response or optimistic update
    if (reactionSummary) {
      setPost(prevPost => ({
        ...prevPost,
        reactionsCount: reactionSummary.total_count,
        currentUserReaction: reactionSummary.user_reaction || undefined,
      }))
    } else {
      // Fallback optimistic update
      setPost(prevPost => ({
        ...prevPost,
        reactionsCount: Math.max(0, (prevPost.reactionsCount || 0) - 1),
        currentUserReaction: undefined,
      }))
    }
  }

  // Handle share interaction
  const handleShare = async (postId: string) => {
    // Sharing is allowed for both authenticated and unauthenticated users
    // The ShareModal will handle authentication requirements internally
  }

  // Handle user profile navigation
  const handleUserClick = (userId: string) => {
    router.push(`/profile/${userId}`)
  }

  return (
    <PostCard 
      post={post}
      currentUserId={isUserAuthenticated ? currentUserId : undefined}
      onHeart={handleHeart}
      onReaction={handleReaction}
      onRemoveReaction={handleRemoveReaction}
      onShare={handleShare}
      onUserClick={handleUserClick}
    />
  )
}
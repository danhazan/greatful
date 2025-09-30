'use client'

import { useEffect, useCallback, useState } from 'react'
import { useUser } from '@/contexts/UserContext'

interface Post {
  id: string
  content: string
  author: {
    id: string
    name: string
    username?: string
    display_name?: string
    image?: string
  }
  createdAt: string
  updatedAt?: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount: number
  isHearted: boolean
  reactionsCount: number
  currentUserReaction?: string
}

interface UsePostStateOptions {
  post: Post
  onPostUpdate?: (updatedPost: Post) => void
}

interface PostStateHook {
  post: Post
  updatePost: (updates: Partial<Post>) => void
}

export function usePostState({ post: initialPost, onPostUpdate }: UsePostStateOptions): PostStateHook {
  const [post, setPost] = useState(initialPost)
  const { subscribeToStateUpdates } = useUser()

  // Sync with prop changes
  useEffect(() => {
    setPost(initialPost)
  }, [initialPost])

  // Subscribe to user profile updates that affect this post
  useEffect(() => {
    const unsubscribe = subscribeToStateUpdates((event) => {
      switch (event.type) {
        case 'USER_PROFILE_UPDATE':
          // Update post author info if this post is by the updated user
          if (event.payload.userId === post.author.id) {
            const updatedPost = {
              ...post,
              author: {
                ...post.author,
                name: event.payload.updates.display_name || event.payload.updates.name || post.author.name,
                display_name: event.payload.updates.display_name || post.author.display_name,
                username: event.payload.updates.username || post.author.username,
                image: event.payload.updates.image || post.author.image
              }
            }
            setPost(updatedPost)
            onPostUpdate?.(updatedPost)
          }
          break
        case 'CURRENT_USER_UPDATE':
          // Update post author info if this post is by the current user
          if (event.payload.name !== undefined || event.payload.image !== undefined) {
            const updatedPost = {
              ...post,
              author: {
                ...post.author,
                name: event.payload.name || post.author.name,
                display_name: event.payload.name || post.author.display_name,
                image: event.payload.image || post.author.image
              }
            }
            setPost(updatedPost)
            onPostUpdate?.(updatedPost)
          }
          break
      }
    })

    return unsubscribe
  }, [post, onPostUpdate, subscribeToStateUpdates])

  // Update post state
  const updatePost = useCallback((updates: Partial<Post>) => {
    const updatedPost = { ...post, ...updates }
    setPost(updatedPost)
    onPostUpdate?.(updatedPost)
  }, [post, onPostUpdate])

  return {
    post,
    updatePost
  }
}
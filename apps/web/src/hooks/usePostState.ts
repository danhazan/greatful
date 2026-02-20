'use client'

import { useEffect, useCallback, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { Post } from '@/types/post'

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
            const updatedPost: Post = {
              ...post,
              author: {
                ...post.author,
                name: event.payload.updates.name || post.author.name,
                displayName: event.payload.updates.displayName || post.author.displayName,
                username: event.payload.updates.username || post.author.username,
                profileImageUrl: event.payload.updates.profileImageUrl || post.author.profileImageUrl,
                followerCount: event.payload.updates.followerCount || post.author.followerCount || 0,
                followingCount: event.payload.updates.followingCount || post.author.followingCount || 0,
                postsCount: event.payload.updates.postsCount || post.author.postsCount || 0,
              }
            }
            setPost(updatedPost)
            onPostUpdate?.(updatedPost)
          }
          break
        case 'CURRENT_USER_UPDATE':
          // Update post author info if this post is by the current user
          if (event.payload.name !== undefined || event.payload.displayName !== undefined || event.payload.profileImageUrl !== undefined) {
            const updatedPost: Post = {
              ...post,
              author: {
                ...post.author,
                name: event.payload.name || post.author.name,
                displayName: event.payload.displayName || post.author.displayName,
                profileImageUrl: event.payload.profileImageUrl || post.author.profileImageUrl,
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
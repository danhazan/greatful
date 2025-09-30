'use client'

import React from 'react'
import PostCard from './PostCard'
import { usePostState } from '@/hooks/usePostState'
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

interface SynchronizedPostCardProps {
  post: Post
  currentUserId?: string
  hideFollowButton?: boolean
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
  onRemoveReaction?: (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => void
  onShare?: (postId: string) => void
  onUserClick?: (userId: string) => void
  onEdit?: (postId: string, updatedPost: Post) => void
  onDelete?: (postId: string) => void
  onPostUpdate?: (updatedPost: Post) => void
}

export default function SynchronizedPostCard(props: SynchronizedPostCardProps) {
  const { post: synchronizedPost, updatePost } = usePostState({
    post: props.post,
    onPostUpdate: props.onPostUpdate
  })

  // Enhanced onEdit handler that updates local state
  const handleEdit = (postId: string, updatedPost: Post) => {
    updatePost(updatedPost)
    props.onEdit?.(postId, updatedPost)
  }

  return (
    <PostCard
      {...props}
      post={synchronizedPost}
      onEdit={handleEdit}
    />
  )
}
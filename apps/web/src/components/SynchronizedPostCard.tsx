'use client'

import React from 'react'
import PostCard from './PostCard'
import { usePostState } from '@/hooks/usePostState'
import { Post } from '@/types/post'

interface SynchronizedPostCardProps {
  post: Post
  currentUserId?: string
  hideFollowButton?: boolean
  onHeart?: (postId: string, isCurrentlyHearted: boolean, heartInfo?: { heartsCount: number, isHearted: boolean }) => void
  onReaction?: (postId: string, emojiCode: string, reactionSummary?: { totalCount: number, reactions: { [key: string]: number }, userReaction: string | null }) => void
  onRemoveReaction?: (postId: string, reactionSummary?: { totalCount: number, reactions: { [key: string]: number }, userReaction: string | null }) => void
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
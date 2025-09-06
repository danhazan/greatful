"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PostCard from './PostCard'
import { useToast } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'

interface SinglePostViewProps {
  postId: string
}

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
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  location_data?: {
    display_name: string
    lat: number
    lon: number
    place_id?: string
    address: {
      city?: string
      state?: string
      country?: string
      country_code?: string
    }
    importance?: number
    type?: string
  }
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
}

export default function SinglePostView({ postId }: SinglePostViewProps) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { showError } = useToast()
  const { currentUser } = useUser()

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = localStorage.getItem('access_token')
        if (!token) {
          setError('Authentication required')
          return
        }

        const response = await fetch(`/api/posts/${postId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            setError('Post not found')
          } else if (response.status === 401) {
            setError('Authentication required')
          } else {
            setError('Failed to load post')
          }
          return
        }

        const postData = await response.json()
        setPost(postData)
      } catch (error) {
        console.error('Error fetching post:', error)
        setError('Failed to load post')
        showError('Network Error', 'Failed to load post. Please check your connection.')
      } finally {
        setLoading(false)
      }
    }

    if (postId) {
      fetchPost()
    }
  }, [postId, showError])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2 text-gray-600">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <span>Loading post...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">{error}</h3>
        <p className="text-gray-500 mb-4">
          {error === 'Post not found'
            ? 'This post may have been deleted or you may not have permission to view it.'
            : 'Please try again or check your internet connection.'
          }
        </p>
        <button
          onClick={() => router.push('/feed')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Back to Feed
        </button>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Post not found</p>
        <button
          onClick={() => router.push('/feed')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
        >
          Back to Feed
        </button>
      </div>
    )
  }

  return (
    <PostCard
      post={post}
      currentUserId={currentUser?.id}
      onUserClick={(userId) => {
        router.push(`/profile/${userId}`)
      }}
      onHeart={(postId, isCurrentlyHearted, heartInfo) => {
        if (heartInfo) {
          setPost(prev => prev ? {
            ...prev,
            heartsCount: heartInfo.hearts_count,
            isHearted: heartInfo.is_hearted
          } : null)
        }
      }}
      onReaction={(postId, emojiCode, reactionSummary) => {
        if (reactionSummary) {
          setPost(prev => prev ? {
            ...prev,
            reactionsCount: reactionSummary.total_count,
            currentUserReaction: reactionSummary.user_reaction || undefined
          } : null)
        }
      }}
      onRemoveReaction={(postId, reactionSummary) => {
        if (reactionSummary) {
          setPost(prev => prev ? {
            ...prev,
            reactionsCount: reactionSummary.total_count,
            currentUserReaction: reactionSummary.user_reaction || undefined
          } : null)
        }
      }}
    />
  )
}
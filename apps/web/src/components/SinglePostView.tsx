"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PostCard from './PostCard'
import { useToast } from '@/contexts/ToastContext'
import { useUser } from '@/contexts/UserContext'
import { apiClient } from '@/utils/apiClient'
import { normalizePostFromApi } from '@/utils/normalizePost'
import { Post } from '@/types/post'

interface SinglePostViewProps {
  postId: string
  bootstrapPost?: Post | null
}

export default function SinglePostView({ postId, bootstrapPost = null }: SinglePostViewProps) {
  // SSR Hydration Guard: Fail-closed verification.
  // Anonymous bootstrap payloads must never contain private or custom-restricted data.
  // If bootstrap data is present but not explicitly public, do NOT render until CSR verification.
  const isBootstrapValid = !bootstrapPost || bootstrapPost.privacyLevel === 'public'
  
  const [post, setPost] = useState<Post | null>(isBootstrapValid ? bootstrapPost : null)
  const [loading, setLoading] = useState(!isBootstrapValid || !bootstrapPost)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { showError } = useToast()
  const { currentUser, loading: userLoading } = useUser()

  // When postId changes, reset to the new SSR bootstrap (if any)
  useEffect(() => {
    const valid = !bootstrapPost || bootstrapPost.privacyLevel === 'public'
    setPost(valid ? bootstrapPost : null)
    setLoading(!valid || !bootstrapPost)
    setError(null)
  }, [bootstrapPost, postId])

  useEffect(() => {
    const fetchPost = async () => {
      try {
        // Only show loading spinner if we have no bootstrap data at all
        if (!bootstrapPost) {
          setLoading(true)
        }
        setError(null)

        // Fetch with authentication (apiClient automatically attaches Authorization header)
        const postData = await apiClient.get(`/posts/${postId}`, { skipCache: true }) as any

        // INVARIANT: Full replacement through canonical normalization.
        // No partial merge. The authenticated payload is the sole source of truth.
        const normalized = normalizePostFromApi(postData)

        if (!normalized) {
          // Fail closed: do NOT silently accept unnormalized payloads.
          // This prevents reintroducing the divergence we just fixed.
          console.error('[SinglePostView] Canonical normalization returned null for non-empty payload:', postData)
          setError('Failed to load post')
          return
        }

        setPost(normalized)
      } catch (apiError: any) {
        // Handle API client errors
        if (apiError.message?.includes('404') || apiError.status === 404) {
          setError('Post not found')
        } else if (apiError.message?.includes('403') || apiError.status === 403) {
          setError('This post is private')
        } else if (apiError.message?.includes('401') || apiError.status === 401) {
          const token = localStorage.getItem('access_token')
          if (!token) {
            setError('Authentication required to view this post')
          } else {
            setError('Failed to load post')
          }
        } else {
          setError('Failed to load post')
        }
        console.error('Error fetching post:', apiError)
        if (!apiError || typeof apiError !== 'object' || !('message' in apiError)) {
          showError('Network Error', 'Failed to load post. Please check your connection.')
        }
      } finally {
        setLoading(false)
      }
    }

    if (!postId) return
    if (userLoading) return

    // ALWAYS fetch if user is authenticated, even if bootstrapPost exists.
    // The SSR payload is anonymous and lacks user-scoped fields.
    if (currentUser) {
      fetchPost()
      return
    }

    // Guest user: only fetch if we have no SSR bootstrap data
    if (!bootstrapPost) {
      fetchPost()
    }
  }, [postId, userLoading, currentUser, showError, bootstrapPost])

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
            : error === 'This post is private'
              ? 'This post is private and can only be viewed by the author.'
              : error === 'Authentication required to view this post'
                ? 'Please log in to view this post.'
                : 'Please try again or check your internet connection.'
          }
        </p>
        <div className="space-x-4">
          {(error === 'Authentication required to view this post' || error === 'This post is private') && (
            <button
              onClick={() => router.push('/auth/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Log In
            </button>
          )}
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Back to Home
          </button>
        </div>
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
      onReaction={(postId, emojiCode, reactionSummary) => {
        // If no current user, redirect to login
        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        if (reactionSummary) {
          setPost(prev => prev ? {
            ...prev,
            reactionsCount: reactionSummary.totalCount,
            currentUserReaction: reactionSummary.userReaction || undefined,
            reactionEmojiCodes: reactionSummary.reactionEmojiCodes ?? prev.reactionEmojiCodes
          } : null)
        }
      }}
      onRemoveReaction={(postId, reactionSummary) => {
        // If no current user, redirect to login
        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        if (reactionSummary) {
          setPost(prev => prev ? {
            ...prev,
            reactionsCount: reactionSummary.totalCount,
            currentUserReaction: reactionSummary.userReaction || undefined,
            reactionEmojiCodes: reactionSummary.reactionEmojiCodes ?? prev.reactionEmojiCodes
          } : null)
        }
      }}
      onEdit={(postId, updatedPost) => {
        // Update the post with the new data
        setPost(updatedPost)
      }}
      onDelete={(postId) => {
        // Redirect to feed after deletion
        router.push('/feed')
      }}
    />
  )
}

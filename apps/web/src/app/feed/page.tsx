"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"
import { apiClient } from "@/utils/apiClient"
import { useUser } from "@/contexts/UserContext"
import Navbar from "@/components/Navbar"
import { Post } from '@/types/post'
import { useInfiniteFeed } from "@/hooks/useInfiniteFeed"
import { queryTags } from "@/utils/queryKeys"
import { isAuthenticated } from "@/utils/auth"
import {
  getScrollDirection,
  getTrueScrollTop,
  shouldTriggerObserverLoad,
} from "@/utils/feedScrollGuards"

export default function FeedPage() {
  const router = useRouter()
  const { currentUser, isLoading: userLoading, logout, updateUserProfile, updateFollowState, markDataAsFresh } = useUser()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [hasAccessToken, setHasAccessToken] = useState<boolean | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollDirectionRef = useRef<'up' | 'down' | 'idle'>('idle')
  const lastKnownScrollTopRef = useRef(0)
  const observerVisibleRef = useRef(false)

  // Populate UserContext cache from post author data
  const populateAuthorCache = useCallback((postList: Post[]) => {
    const uniqueAuthors = new Map<string, any>()
    postList.forEach(post => {
      if (post.author && post.author.id && post.author.id !== currentUser?.id) {
        uniqueAuthors.set(post.author.id.toString(), post.author)
      }
    })
    if (uniqueAuthors.size > 0) {
      uniqueAuthors.forEach((author, authorId) => {
        updateUserProfile(authorId, {
          id: authorId,
          name: author.displayName || author.name || author.username,
          username: author.username,
          profileImageUrl: author.profileImageUrl,
          displayName: author.displayName,
          followerCount: author.followerCount || 0,
          followingCount: author.followingCount || 0,
          postsCount: author.postsCount || 0
        })
        if (author.isFollowing !== undefined) {
          updateFollowState(authorId, author.isFollowing)
        }
        markDataAsFresh(authorId)
      })
    }
  }, [currentUser?.id, updateUserProfile, updateFollowState, markDataAsFresh])
  const authResolved = hasAccessToken !== null && !userLoading
  const canQueryFeed = authResolved && !!hasAccessToken
  const {
    items: posts,
    nextCursor,
    hasMore,
    isInitialLoading,
    isFetchingNextPage,
    isRefreshing,
    error,
    refresh,
    loadNextPage,
    patchPost,
    removePost,
  } = useInfiniteFeed({
    enabled: canQueryFeed,
    currentUserId: currentUser?.id,
    onPostsLoaded: populateAuthorCache,
  })

  const getScrollMetrics = useCallback(() => {
    const containerScrollTop = scrollContainerRef.current?.scrollTop ?? 0
    const windowScrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const documentScrollTop = typeof document !== 'undefined' ? document.documentElement.scrollTop : 0
    const trueScrollTop = getTrueScrollTop({
      containerScrollTop,
      windowScrollY,
      documentScrollTop,
    })

    return {
      containerScrollTop,
      windowScrollY,
      documentScrollTop,
      trueScrollTop,
    }
  }, [])

  useEffect(() => {
    setHasAccessToken(isAuthenticated())
  }, [])

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
      return
    }
    if (userLoading) return
    if (!currentUser) {
      const t = setTimeout(() => {
        if (!currentUser) {
          router.push("/auth/login")
        }
      }, 200)
      return () => clearTimeout(t)
    }
  }, [currentUser, userLoading, router])

  useEffect(() => {
    const handleScroll = () => {
      const metrics = getScrollMetrics()
      const direction = getScrollDirection(lastKnownScrollTopRef.current, metrics.trueScrollTop)
      scrollDirectionRef.current = direction
      lastKnownScrollTopRef.current = metrics.trueScrollTop
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [getScrollMetrics])

  useEffect(() => {
    observerVisibleRef.current = false
  }, [nextCursor])

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || !nextCursor) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const shouldLoad = shouldTriggerObserverLoad({
          isIntersecting: entry.isIntersecting,
          wasIntersecting: observerVisibleRef.current,
          hasMore,
          hasCursor: !!nextCursor,
          isFetching: isFetchingNextPage || isRefreshing,
          scrollDirection: scrollDirectionRef.current,
        })

        if (shouldLoad) {
          void loadNextPage()
        }

        observerVisibleRef.current = entry.isIntersecting
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, nextCursor, loadNextPage, isFetchingNextPage, isRefreshing])

  const handleLogout = () => {
    // Use centralized logout from UserContext (handles token removal, notification cleanup, etc.)
    logout()

    // Redirect to home page
    router.push("/")
  }



  const handleReaction = (postId: string, emojiCode: string, reactionSummary?: any) => {
    patchPost(postId, (post) => ({
      ...post,
      reactionsCount: reactionSummary ? reactionSummary.totalCount : (post.reactionsCount || 0) + 1,
      currentUserReaction: emojiCode,
      reactionEmojiCodes: reactionSummary?.reactionEmojiCodes ?? post.reactionEmojiCodes
    }))
  }

  const handleRemoveReaction = (postId: string, reactionSummary?: any) => {
    patchPost(postId, (post) => ({
      ...post,
      reactionsCount: reactionSummary ? reactionSummary.totalCount : Math.max(0, (post.reactionsCount || 1) - 1),
      currentUserReaction: null,
      reactionEmojiCodes: reactionSummary?.reactionEmojiCodes ?? post.reactionEmojiCodes
    }))
  }

  const handleShare = (postId: string) => {
    // Share handling is now managed by PostCard's internal ShareModal
    // This callback can be used for analytics or other side effects
    console.log('Post shared:', postId)
  }

  const handleUserClick = (userId: string) => {
    if (userId === "current-user" || userId === currentUser?.id) {
      router.push("/profile")
    } else {
      // Navigate to specific user's profile
      router.push(`/profile/${userId}`)
    }
  }

  const handleEditPost = (postId: string, updatedPost: Post) => {
    patchPost(postId, () => updatedPost)
  }

  const handleDeletePost = (postId: string) => {
    removePost(postId)
  }

  const refreshPosts = useCallback(async (reason: string) => {
    await refresh(reason)
  }, [refresh])

  const handleCreatePost = async (postData: {
    content: string
    imageUrl?: string
    location?: string
    location_data?: any
    imageFile?: File
    imageFiles?: File[]  // Multi-image support
    richContent?: string
    postStyle?: any
    mentions?: string[]
    privacyLevel?: 'public' | 'private' | 'custom'
    privacyRules?: string[]
    specificUsers?: number[]
  }) => {
    setIsCreatingPost(true)

    try {
      const token = localStorage.getItem("access_token")
      if (!token) {
        router.push("/auth/login")
        return
      }

      let response: Response

      // If there are multiple image files, send as FormData with images array
      if (postData.imageFiles && postData.imageFiles.length > 0) {
        const formData = new FormData()
        formData.append('content', postData.content.trim())
        if (postData.richContent) formData.append('richContent', postData.richContent)
        if (postData.postStyle) formData.append('postStyle', JSON.stringify(postData.postStyle))
        if (postData.location) formData.append('location', postData.location)
        if (postData.location_data) formData.append('location_data', JSON.stringify(postData.location_data))
        if (postData.privacyLevel) formData.append('privacyLevel', postData.privacyLevel)
        if (postData.privacyRules) formData.append('privacyRules', JSON.stringify(postData.privacyRules))
        if (postData.specificUsers) formData.append('specificUsers', JSON.stringify(postData.specificUsers))
        // Append all images (backend expects 'images' field for multi-image)
        postData.imageFiles.forEach(file => {
          formData.append('images', file)
        })

        response = await fetch('/api/posts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type for FormData
          },
          body: formData
        })
      } else if (postData.imageFile) {
        // Legacy single image support (deprecated)
        const formData = new FormData()
        formData.append('content', postData.content.trim())
        if (postData.richContent) formData.append('richContent', postData.richContent)
        if (postData.postStyle) formData.append('postStyle', JSON.stringify(postData.postStyle))
        if (postData.location) formData.append('location', postData.location)
        if (postData.location_data) formData.append('location_data', JSON.stringify(postData.location_data))
        if (postData.privacyLevel) formData.append('privacyLevel', postData.privacyLevel)
        if (postData.privacyRules) formData.append('privacyRules', JSON.stringify(postData.privacyRules))
        if (postData.specificUsers) formData.append('specificUsers', JSON.stringify(postData.specificUsers))
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
            richContent: postData.richContent,
            postStyle: postData.postStyle,
            imageUrl: postData.imageUrl,
            location: postData.location,
            location_data: postData.location_data,
            privacyLevel: postData.privacyLevel,
            privacyRules: postData.privacyRules,
            specificUsers: postData.specificUsers
          })
        })
      }

      if (!response.ok) {
        // Handle non-JSON error responses gracefully (e.g., "Forbidden" from proxy/WAF)
        let errorMessage = 'Failed to create post'
        try {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.detail || errorMessage
          } else {
            // Non-JSON response (e.g., proxy error, WAF block)
            const text = await response.text()
            if (text.toLowerCase().includes('forbidden')) {
              errorMessage = 'Upload blocked - the image may be too large or contain unsupported content. Try a smaller image (under 5MB).'
            } else if (text.toLowerCase().includes('too large') || text.toLowerCase().includes('payload')) {
              errorMessage = 'Image file is too large. Maximum size is 5MB per image.'
            } else if (response.status === 413) {
              errorMessage = 'Image file is too large. Maximum size is 5MB per image.'
            } else if (response.status === 403) {
              errorMessage = 'Upload blocked by security rules. Try a different image.'
            } else {
              errorMessage = `Upload failed (${response.status}): ${text.substring(0, 100)}`
            }
          }
        } catch {
          // If even reading the response fails, use status code
          if (response.status === 413) {
            errorMessage = 'Image file is too large. Maximum size is 5MB per image.'
          } else if (response.status === 403) {
            errorMessage = 'Upload blocked by security rules. Try a different image.'
          }
        }
        throw new Error(errorMessage)
      }

      // Refresh feed with a network read so the newly created post is visible immediately
      await refreshPosts('post-create')

      if (currentUser?.id) {
        apiClient.invalidateTags([
          queryTags.feed,
          queryTags.userPosts(currentUser.id),
          queryTags.currentUserProfile,
          queryTags.userProfile(currentUser.id),
        ])
      }

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

  if (!authResolved || (hasAccessToken && isInitialLoading)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your Grateful feed...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Feed</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <Navbar user={currentUser ? {
        id: currentUser.id,
        name: currentUser.displayName || currentUser.name,
        displayName: currentUser.displayName,
        username: currentUser.username,
        email: currentUser.email,
        profileImageUrl: currentUser.profileImageUrl
      } : undefined} onLogout={handleLogout} />

      {/* Main Content */}
      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 relative"
        ref={scrollContainerRef}
      >
        <div className="max-w-2xl mx-auto">
          {/* Posts */}
          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-600 mb-4">Be the first to share your gratitude!</p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  Create Your First Post
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id}
                  onReaction={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onShare={handleShare}
                  onUserClick={handleUserClick}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                />
              ))
            )}
          </div>

          {/* Infinite scroll sentinel + loading indicator (v2 only) */}
          {posts.length > 0 && (
            <>
              <div ref={sentinelRef} className="h-1" />
              {isFetchingNextPage && (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              )}
            </>
          )}

          {/* Floating Create Post Button */}
          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
              title="Create New Post"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
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

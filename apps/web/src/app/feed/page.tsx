"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, RefreshCw, ArrowDown } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"
import { normalizePostFromApi } from "@/utils/normalizePost"
import { apiClient } from "@/utils/apiClient"
import { useUser } from "@/contexts/UserContext"
import Navbar from "@/components/Navbar"
import { Post } from '@/types/post'
import { useTaggedQuery } from "@/hooks/useTaggedQuery"
import { queryKeys, queryTags } from "@/utils/queryKeys"
import { isAuthenticated } from "@/utils/auth"

function extractPostPrivacy(post: any): {
  privacyLevel?: 'public' | 'private' | 'custom'
  privacyRules?: string[]
  specificUsers?: number[]
} {
  const privacyLevelRaw = post?.privacyLevel
  const privacyRulesRaw = post?.privacyRules
  const specificUsersRaw = post?.specificUsers

  return {
    privacyLevel:
      privacyLevelRaw === 'public' || privacyLevelRaw === 'private' || privacyLevelRaw === 'custom'
        ? privacyLevelRaw
        : undefined,
    privacyRules: Array.isArray(privacyRulesRaw) ? privacyRulesRaw : undefined,
    specificUsers: Array.isArray(specificUsersRaw) ? specificUsersRaw : undefined,
  }
}

export default function FeedPage() {
  const router = useRouter()
  const { currentUser, isLoading: userLoading, logout, updateUserProfile, updateFollowState, markDataAsFresh } = useUser()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasAccessToken, setHasAccessToken] = useState<boolean | null>(null)

  // Cursor pagination state
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Pull-to-refresh state
  const [isPullToRefresh, setIsPullToRefresh] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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

  // Hydrate privacy metadata for current user's own posts
  const hydratePrivacy = useCallback(async (normalizedPosts: Post[], refresh: boolean): Promise<Post[]> => {
    if (!currentUser?.id) return normalizedPosts
    const needsHydration = normalizedPosts.some(
      (post) => post.author?.id === currentUser.id && !post.privacyLevel
    )
    if (!needsHydration) return normalizedPosts

    try {
      const myPostsResponse = await apiClient.get('/users/me/posts', { skipCache: refresh }) as any
      const myPosts = myPostsResponse?.data || myPostsResponse
      if (!Array.isArray(myPosts)) return normalizedPosts

      const privacyByPostId = new Map<string, { privacyLevel?: 'public' | 'private' | 'custom'; privacyRules?: string[]; specificUsers?: number[] }>()
      myPosts.forEach((myPost: any) => {
        const postId = String(myPost?.id || '')
        if (postId) privacyByPostId.set(postId, extractPostPrivacy(myPost))
      })

      return normalizedPosts.map((post) => {
        if (post.author?.id !== currentUser.id) return post
        const privacy = privacyByPostId.get(post.id)
        if (!privacy) return post
        return {
          ...post,
          privacyLevel: privacy.privacyLevel ?? post.privacyLevel,
          privacyRules: privacy.privacyRules ?? post.privacyRules,
          specificUsers: privacy.specificUsers ?? post.specificUsers,
        }
      })
    } catch {
      console.warn('[Feed] Failed to hydrate own post privacy metadata')
      return normalizedPosts
    }
  }, [currentUser?.id])

  const fetchFeedQuery = useCallback(async () => {
    const data = await apiClient.get<{ posts: any[]; nextCursor: string | null }>('/posts', {
      skipCache: true,
    })

    const rawPosts = (data as any)?.posts ?? (data as any)?.data?.posts ?? []
    if (!Array.isArray(rawPosts)) throw new Error('Invalid posts data format')

    const normalizedPosts = rawPosts.map((p: any) => normalizePostFromApi(p)).filter(Boolean) as Post[]
    const hydratedPosts = await hydratePrivacy(normalizedPosts, false)

    return {
      posts: hydratedPosts,
      nextCursor: (data as any)?.nextCursor ?? (data as any)?.data?.nextCursor ?? null,
    }
  }, [hydratePrivacy])

  const feedQueryKey = useMemo(() => queryKeys.feed(), [])
  const feedQueryTags = useMemo(() => [queryTags.feed], [])
  const authResolved = hasAccessToken !== null && !userLoading
  const canQueryFeed = authResolved && !!hasAccessToken

  const {
    data: feedQueryData,
    error: feedQueryError,
    isLoading: feedQueryLoading,
    refetch: refetchFeedQuery,
  } = useTaggedQuery({
    queryKey: feedQueryKey,
    tags: feedQueryTags,
    policy: 'network-first', // TODO: migrate feed to stale-while-revalidate once unified behavior is validated.
    enabled: canQueryFeed,
    fetcher: fetchFeedQuery,
    viewerScope: apiClient.getViewerScope(),
  })

  // Load more posts (appends next page)
  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMoreRef.current) return

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      const data = await apiClient.get<{ posts: any[]; nextCursor: string | null }>(
        `/posts?cursor=${encodeURIComponent(nextCursor)}&page_size=10`,
        { skipCache: true }
      )

      const rawPosts = (data as any)?.posts ?? []
      if (!Array.isArray(rawPosts)) return

      const normalizedPosts = rawPosts.map((p: any) => normalizePostFromApi(p)).filter(Boolean) as Post[]
      const hydratedPosts = await hydratePrivacy(normalizedPosts, false)

      setPosts(prev => [...prev, ...hydratedPosts])
      setNextCursor((data as any)?.nextCursor ?? null)
      populateAuthorCache(hydratedPosts)
    } catch (error) {
      console.error('Error loading more posts:', error)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [nextCursor, populateAuthorCache, hydratePrivacy])

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
    if (!authResolved) {
      setIsLoading(true)
      return
    }

    if (!hasAccessToken) {
      setIsLoading(false)
      return
    }

    if (feedQueryData?.posts) {
      setPosts(feedQueryData.posts)
      setNextCursor(feedQueryData.nextCursor)
      populateAuthorCache(feedQueryData.posts)
    } else if (feedQueryError) {
      setPosts([])
    }

    setError(feedQueryError ? feedQueryError.message : null)
    const nextLoadingState = canQueryFeed && (feedQueryLoading || (!feedQueryData && !feedQueryError))
    setIsLoading(nextLoadingState)
  }, [authResolved, canQueryFeed, hasAccessToken, feedQueryData, feedQueryError, feedQueryLoading, populateAuthorCache])

  // Infinite scroll observer
  useEffect(() => {
    if (!nextCursor) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, loadMore])

  const handleLogout = () => {
    // Clear local posts state
    setPosts([])

    // Use centralized logout from UserContext (handles token removal, notification cleanup, etc.)
    logout()

    // Redirect to home page
    router.push("/")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: { heartsCount: number, isHearted: boolean }) => {
    // heart is now handled via handleReaction as a unified emoji code.
    // This handler is preserved as a no-op for backward compatibility with component props.
  }

  const handleReaction = (postId: string, emojiCode: string, reactionSummary?: any) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: reactionSummary ? reactionSummary.totalCount : (post.reactionsCount || 0) + 1,
          currentUserReaction: emojiCode,
          reactionEmojiCodes: reactionSummary?.reactionEmojiCodes ?? post.reactionEmojiCodes
        }
      }
      return post
    }))
  }

  const handleRemoveReaction = (postId: string, reactionSummary?: any) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: reactionSummary ? reactionSummary.totalCount : Math.max(0, (post.reactionsCount || 1) - 1),
          currentUserReaction: null,
          reactionEmojiCodes: reactionSummary?.reactionEmojiCodes ?? post.reactionEmojiCodes
        }
      }
      return post
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
    // Update the post in the local state
    setPosts(posts.map(post =>
      post.id === postId ? updatedPost : post
    ))
  }

  const handleDeletePost = (postId: string) => {
    // Remove the post from the local state
    setPosts(posts.filter(post => post.id !== postId))
  }

  const refreshPosts = useCallback(async () => {
    setNextCursor(null)
    await refetchFeedQuery()
  }, [refetchFeedQuery])

  // Touch event handlers for pull-to-refresh
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollContainerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (scrollContainerRef.current?.scrollTop === 0 && !isPullToRefresh) {
      const currentY = e.touches[0].clientY
      const distance = Math.max(0, currentY - touchStartY.current)

      if (distance > 0) {
        setPullDistance(Math.min(distance * 0.5, 100)) // Damping effect
      }
    }
  }, [isPullToRefresh])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > 60 && !isPullToRefresh) {
      setIsPullToRefresh(true)
      await refreshPosts()
      setIsPullToRefresh(false)
    }
    setPullDistance(0)
    touchStartY.current = 0
  }, [pullDistance, isPullToRefresh, refreshPosts])

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
      await refreshPosts()

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

  if (isLoading) {
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
          <p className="text-gray-600 mb-4">{error}</p>
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {pullDistance > 0 && (
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-center bg-purple-50 border-b border-purple-200 transition-all duration-200 z-10"
            style={{
              height: `${Math.min(pullDistance, 80)}px`,
              opacity: pullDistance / 60
            }}
          >
            <div className="flex items-center gap-2 text-purple-600">
              {pullDistance > 60 ? (
                <>
                  <RefreshCw className={`h-4 w-4 ${isPullToRefresh ? 'animate-spin' : ''}`} />
                  <span className="text-sm font-medium">
                    {isPullToRefresh ? 'Refreshing...' : 'Release to refresh'}
                  </span>
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4" />
                  <span className="text-sm font-medium">Pull to refresh</span>
                </>
              )}
            </div>
          </div>
        )}

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
                  onHeart={handleHeart}
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
              {isLoadingMore && (
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

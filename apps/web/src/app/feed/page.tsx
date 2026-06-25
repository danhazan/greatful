"use client"

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus, Calendar, Filter, Search } from "lucide-react"
import PostCard from "@/components/PostCard"
import CreatePostModal from "@/components/CreatePostModal"
import { apiClient } from "@/utils/apiClient"
import { getAccessToken } from "@/utils/auth"
import { useUser } from "@/contexts/UserContext"
import Navbar from "@/components/Navbar"
import { Post } from '@/types/post'
import { useInfiniteFeed } from "@/hooks/useInfiniteFeed"
import { queryTags } from "@/utils/queryKeys"
import { useRequireAuth } from "@/hooks/useAuthRedirect"
import {
  getScrollDirection,
  getTrueScrollTop,
  shouldTriggerObserverLoad,
} from "@/utils/feedScrollGuards"
import {
  AppliedFeedFilters,
  cloneFeedFilters,
  createEmptyFeedFilters,
  parseFeedFiltersFromSearchParams,
  serializeFeedFiltersToUrl,
  DEFAULT_TYPE_FILTERS,
} from "@/utils/feedFilterState"
import DateFilterModal from "./DateFilterModal"
import TypeFilterModal from "./TypeFilterModal"
import SearchFilterModal from "./SearchFilterModal"

type ModalType = 'date' | 'type' | 'search' | null

function computeAppliedFiltersFromUrl(): AppliedFeedFilters {
  if (typeof window === 'undefined') return createEmptyFeedFilters()
  const params = new URLSearchParams(window.location.search)
  return parseFeedFiltersFromSearchParams(params)
}

export default function FeedPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
      </div>
    }>
      <FeedPage />
    </Suspense>
  )
}

function FeedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, isLoading: userLoading, isAuthTransitioning, logout, updateUserProfile, updateFollowState, markDataAsFresh } = useUser()

  const requireAuth = useRequireAuth()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const scrollDirectionRef = useRef<'up' | 'down' | 'idle'>('idle')
  const lastKnownScrollTopRef = useRef(0)
  const observerVisibleRef = useRef(false)

  // --- Modal filter state ---
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [appliedFilters, setAppliedFilters] = useState<AppliedFeedFilters>(() => computeAppliedFiltersFromUrl())
  const [draftFilters, setDraftFilters] = useState<AppliedFeedFilters>(() => cloneFeedFilters(appliedFilters))
  const [authorProfiles, setAuthorProfiles] = useState<Record<number, { username: string; name: string }>>({})
  const modalBaselineRef = useRef<AppliedFeedFilters | null>(null)
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null)

  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const typeBtnRef = useRef<HTMLButtonElement>(null)
  const searchBtnRef = useRef<HTMLButtonElement>(null)

  const buttonRefForModal = useCallback((modal: ModalType): HTMLButtonElement | null => {
    if (modal === 'date') return dateBtnRef.current
    if (modal === 'type') return typeBtnRef.current
    if (modal === 'search') return searchBtnRef.current
    return null
  }, [])

  const computeModalPosition = useCallback((modal: ModalType) => {
    const btnRef = buttonRefForModal(modal)
    if (!btnRef) return null
    const rect = btnRef.getBoundingClientRect()
    const isMobile = window.innerWidth < 640
    const modalWidth = isMobile ? window.innerWidth - 24 : 384
    const x = isMobile ? 12 : Math.round((window.innerWidth - modalWidth) / 2)
    return { x, y: rect.bottom }
  }, [buttonRefForModal])

  const openModal = useCallback((modal: ModalType) => {
    if (modal === null) {
      setActiveModal(null)
      setModalPosition(null)
      return
    }
    const draft = cloneFeedFilters(appliedFilters)
    setDraftFilters(draft)
    modalBaselineRef.current = cloneFeedFilters(appliedFilters)
    const pos = computeModalPosition(modal)
    setModalPosition(pos)
    setActiveModal(modal)
  }, [appliedFilters, computeModalPosition])

  const dismissModal = useCallback(() => {
    setActiveModal(null)
    setModalPosition(null)
    modalBaselineRef.current = null
  }, [])

  const closeModal = useCallback(() => {
    if (modalBaselineRef.current) {
      setDraftFilters(cloneFeedFilters(modalBaselineRef.current))
    }
    setActiveModal(null)
    setModalPosition(null)
    modalBaselineRef.current = null
  }, [])

  const clearDraft = useCallback((modal: ModalType) => {
    if (!modal) return
    const cleared = cloneFeedFilters(draftFilters)
    if (modal === 'date') {
      cleared.date = { mode: 'off' }
    } else if (modal === 'type') {
      cleared.type = { ...DEFAULT_TYPE_FILTERS }
    } else if (modal === 'search') {
      cleared.search = {
        authors: { mode: 'off', users: [] },
        keyword: { mode: 'off', text: '' },
      }
    }
    setDraftFilters(cleared)
  }, [draftFilters])

  const applyDraft = useCallback((modal: ModalType) => {
    if (!modal) return
    const merged = cloneFeedFilters(appliedFilters)
    if (modal === 'date') {
      merged.date = cloneFeedFilters(draftFilters.date)
    } else if (modal === 'type') {
      merged.type = cloneFeedFilters(draftFilters.type)
    } else if (modal === 'search') {
      merged.search = cloneFeedFilters(draftFilters.search)
    }
    setAppliedFilters(merged)
    setActiveModal(null)
    setModalPosition(null)
    modalBaselineRef.current = null

    const url = serializeFeedFiltersToUrl(merged)
    window.history.replaceState(null, '', url)
  }, [appliedFilters, draftFilters])

  // Recompute position on resize
  useEffect(() => {
    if (!activeModal) return
    const handleResize = () => {
      const pos = computeModalPosition(activeModal)
      setModalPosition(pos)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeModal, computeModalPosition])

  const isApplyDisabled = useCallback((modal: ModalType): boolean => {
    if (!modal) return true
    if (modal === 'date') {
      return JSON.stringify(draftFilters.date) === JSON.stringify(appliedFilters.date)
    }
    if (modal === 'type') {
      return JSON.stringify(draftFilters.type) === JSON.stringify(appliedFilters.type)
    }
    if (modal === 'search') {
      return JSON.stringify(draftFilters.search) === JSON.stringify(appliedFilters.search)
    }
    return true
  }, [appliedFilters, draftFilters])

  // Sync appliedFilters to searchParams on mount and popstate
  useEffect(() => {
    const urlFilters = computeAppliedFiltersFromUrl()
    setAppliedFilters(urlFilters)
  }, [searchParams])

  const feedFilters = useMemo(() => appliedFilters, [appliedFilters])

  // --- Author batch profile hydration ---
  const hydratedAuthorIdsRef = useRef<string>('')
  useEffect(() => {
    const authorIds = Array.from(new Set(
      appliedFilters.search.authors.users
        .filter(u => u.username === null)
        .map(u => u.id)
    ))
    const key = authorIds.sort().join(',')
    if (!key || key === hydratedAuthorIdsRef.current) return
    hydratedAuthorIdsRef.current = key
    const idsParam = authorIds.join(',')
    fetch(`/api/users/batch-profiles?ids=${encodeURIComponent(idsParam)}`, {
      headers: { 'Authorization': `Bearer ${getAccessToken()}` },
    })
      .then(r => r.json())
      .then((res: unknown) => {
        const raw = Array.isArray(res) ? res : (res as Record<string, unknown>)['data']
        const profileArr: Array<{ id: number; username: string; displayName?: string; name?: string }> = Array.isArray(raw) ? raw : []
        const profileMap: Record<number, { username: string; name: string }> = {}
        profileArr.forEach(p => {
          profileMap[Number(p.id)] = { username: p.username, name: p.displayName || p.name || '' }
        })
        setAuthorProfiles(prev => ({ ...prev, ...profileMap }))
      })
      .catch(() => {})
  }, [appliedFilters.search.authors.users])

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
  const authResolved = !userLoading
  const canQueryFeed = authResolved
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
    feedFilters,
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
    if (userLoading) return
    if (!currentUser) {
      const t = setTimeout(() => {
        if (!currentUser) {
          requireAuth()
        }
      }, 200)
      return () => clearTimeout(t)
    }
  }, [currentUser, userLoading, requireAuth])

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
    logout()
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
    console.log('Post shared:', postId)
  }

  const handleUserClick = (userId: string) => {
    if (userId === "current-user" || userId === currentUser?.id) {
      router.push("/profile")
    } else {
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
    imageFiles?: File[]
    richContent?: string
    postStyle?: any
    mentions?: string[]
    privacyLevel?: 'public' | 'private' | 'custom'
    privacyRules?: string[]
    specificUsers?: number[]
  }) => {
    setIsCreatingPost(true)

    try {
      let body: FormData | Record<string, unknown>

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
        postData.imageFiles.forEach(file => {
          formData.append('images', file)
        })
        body = formData
      } else if (postData.imageFile) {
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
        body = formData
      } else {
        body = {
          content: postData.content.trim(),
          richContent: postData.richContent,
          postStyle: postData.postStyle,
          imageUrl: postData.imageUrl,
          location: postData.location,
          location_data: postData.location_data,
          privacyLevel: postData.privacyLevel,
          privacyRules: postData.privacyRules,
          specificUsers: postData.specificUsers
        }
      }

      try {
        await apiClient.post('/posts', body)
      } catch (error) {
        const msg = error instanceof Error ? error.message : ''
        if (msg.includes('413') || /too large|payload|file size/i.test(msg)) {
          throw new Error('Image file is too large. Maximum size is 5MB per image.')
        }
        if (msg.includes('403') || /forbidden|blocked/i.test(msg)) {
          throw new Error('Upload blocked - the image may be too large or contain unsupported content. Try a smaller image (under 5MB).')
        }
        throw error
      }

      await refreshPosts('post-create')

      if (currentUser?.id) {
        apiClient.invalidateTags([
          queryTags.feed,
          queryTags.userPosts(currentUser.id),
          queryTags.currentUserProfile,
          queryTags.userProfile(currentUser.id),
        ])
      }

      setIsCreateModalOpen(false)

    } catch (error) {
      console.error('Error creating post:', error)
      throw error
    } finally {
      setIsCreatingPost(false)
    }
  }

  if (isAuthTransitioning) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your Grateful feed...</p>
        </div>
      </div>
    )
  }

  if (!authResolved || isInitialLoading) {
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
      <Navbar user={currentUser ? {
        id: currentUser.id,
        name: currentUser.displayName || currentUser.name,
        displayName: currentUser.displayName,
        username: currentUser.username,
        email: currentUser.email,
        profileImageUrl: currentUser.profileImageUrl
      } : undefined} onLogout={handleLogout} />

      <main
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-20 relative"
        ref={scrollContainerRef}
      >
        <div className="max-w-2xl mx-auto">
          {/* Filter buttons */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <FilterButton
              icon={<Calendar className="h-4 w-4" />}
              label="Date"
              isActive={appliedFilters.date.mode !== 'off'}
              onClick={() => openModal('date')}
              ref={dateBtnRef}
            />
            <FilterButton
              icon={<Filter className="h-4 w-4" />}
              label="Type"
              isActive={Object.values(appliedFilters.type).some(m => m !== 'off')}
              onClick={() => openModal('type')}
              ref={typeBtnRef}
            />
            <FilterButton
              icon={<Search className="h-4 w-4" />}
              label="Search"
              isActive={appliedFilters.search.authors.mode !== 'off' || appliedFilters.search.keyword.mode !== 'off'}
              onClick={() => openModal('search')}
              ref={searchBtnRef}
            />
          </div>

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

          <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-purple-600 text-white p-3 sm:p-4 rounded-full shadow-lg hover:bg-purple-700 transition-all duration-200 hover:scale-110 min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation"
              title="Create New Post"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          <CreatePostModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onSubmit={handleCreatePost}
          />

          {/* Outside click backdrop — dismiss without reverting */}
          {activeModal && (
            <div
              className="fixed inset-0 z-40"
              onClick={dismissModal}
            />
          )}

          {/* Filter modals */}
          {activeModal === 'date' && modalPosition && (
            <DateFilterModal
              date={draftFilters.date}
              onChange={(date) => setDraftFilters(prev => ({ ...prev, date }))}
              onClose={closeModal}
              onDismiss={dismissModal}
              onClear={() => clearDraft('date')}
              onApply={() => applyDraft('date')}
              isApplyDisabled={isApplyDisabled('date')}
              position={modalPosition}
            />
          )}

          {activeModal === 'type' && modalPosition && (
            <TypeFilterModal
              type={draftFilters.type}
              onChange={(type) => setDraftFilters(prev => ({ ...prev, type }))}
              onClose={closeModal}
              onDismiss={dismissModal}
              onClear={() => clearDraft('type')}
              onApply={() => applyDraft('type')}
              isApplyDisabled={isApplyDisabled('type')}
              position={modalPosition}
            />
          )}

          {activeModal === 'search' && modalPosition && (
            <SearchFilterModal
              search={draftFilters.search}
              onChange={(search) => setDraftFilters(prev => ({ ...prev, search }))}
              onClose={closeModal}
              onDismiss={dismissModal}
              onClear={() => clearDraft('search')}
              onApply={() => applyDraft('search')}
              isApplyDisabled={isApplyDisabled('search')}
              position={modalPosition}
              authorProfiles={authorProfiles}
            />
          )}
        </div>
      </main>
    </div>
  )
}

const FilterButton = React.forwardRef<HTMLButtonElement, {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}>(({ icon, label, isActive, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border-purple-700 bg-purple-600 text-white shadow-sm'
        : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300 hover:text-purple-700'
    }`}
  >
    {icon}
    {label}
  </button>
))
FilterButton.displayName = 'FilterButton'

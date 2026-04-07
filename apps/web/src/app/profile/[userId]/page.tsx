"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { Calendar } from "lucide-react"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"
import FollowButton from "@/components/FollowButton"
import ProfileImageSection from "@/components/ProfileImageSection"
import FollowersModal from "@/components/FollowersModal"
import FollowingModal from "@/components/FollowingModal"
import { transformUserPosts } from "@/lib/transformers"
import { apiClient } from "@/utils/apiClient"
import { useUser } from "@/contexts/UserContext"
import { Post } from '@/types/post'
import { useTaggedQuery } from "@/hooks/useTaggedQuery"
import { queryKeys, queryTags } from "@/utils/queryKeys"
import { isAuthenticated } from "@/utils/auth"

// Redundant local interfaces removed - using Post and Author from @/types/post

interface UserProfile {
  id: string
  username: string
  email: string
  bio?: string
  profileImageUrl?: string
  displayName?: string
  createdAt: string
  postsCount: number
  followersCount?: number
  followingCount?: number
}

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const userId = params['userId'] as string
  const { currentUser, isLoading: userLoading, logout } = useUser()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [postsHighlighted, setPostsHighlighted] = useState(false)
  const [hasAccessToken, setHasAccessToken] = useState<boolean | null>(null)

  // Listen for follower count updates from follow actions
  useEffect(() => {
    const handleFollowerCountUpdate = (e: CustomEvent) => {
      if (profile && e.detail.userId === profile.id.toString()) {
        setProfile(prev => prev ? {
          ...prev,
          followersCount: e.detail.isFollowing
            ? (prev.followersCount || 0) + 1
            : Math.max(0, (prev.followersCount || 0) - 1)
        } : null)
      }
    }

    window.addEventListener('followerCountUpdate', handleFollowerCountUpdate as EventListener)
    return () => window.removeEventListener('followerCountUpdate', handleFollowerCountUpdate as EventListener)
  }, [profile])

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push("/auth/login")
      return
    }

    if (userLoading) return

    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
    }
  }, [router, currentUser, userLoading])

  const publicProfileQueryKey = useMemo(
    () => (userId ? queryKeys.userProfile(userId) : queryKeys.userProfile('pending')),
    [userId]
  )
  const publicProfileTags = useMemo(
    () => (userId ? [queryTags.userProfile(userId)] : []),
    [userId]
  )
  const publicPostsQueryKey = useMemo(
    () => (userId ? queryKeys.userPosts(userId) : queryKeys.userPosts('pending')),
    [userId]
  )
  const publicPostsTags = useMemo(
    () => (userId ? [queryTags.userPosts(userId)] : []),
    [userId]
  )
  const authResolved = hasAccessToken !== null && !userLoading
  const canQueryProfile = authResolved && !!hasAccessToken && !!userId
  const fetchPublicProfile = useCallback(
    async () => apiClient.getUserProfile(userId, { skipCache: true }),
    [userId]
  )
  const fetchPublicPosts = useCallback(async () => {
    let postsData
    if (userId === currentUser?.id?.toString()) {
      postsData = await apiClient.get('/users/me/posts', { skipCache: true })
    } else {
      postsData = await apiClient.getUserPosts(userId, { skipCache: true })
    }

    const transformedPosts = Array.isArray(postsData) ? transformUserPosts(postsData) : []
    return transformedPosts.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [currentUser?.id, userId])

  const {
    data: profileQueryData,
    error: profileQueryError,
    isLoading: profileQueryLoading,
  } = useTaggedQuery({
    queryKey: publicProfileQueryKey,
    tags: publicProfileTags,
    policy: 'cache-first-until-invalidated',
    enabled: canQueryProfile,
    viewerScope: apiClient.getViewerScope(),
    fetcher: fetchPublicProfile,
  })

  const {
    data: postsQueryData,
    error: postsQueryError,
    isLoading: postsQueryLoading,
  } = useTaggedQuery({
    queryKey: publicPostsQueryKey,
    tags: publicPostsTags,
    policy: 'cache-first-until-invalidated',
    enabled: canQueryProfile,
    viewerScope: apiClient.getViewerScope(),
    fetcher: fetchPublicPosts,
  })

  useEffect(() => {
    setHasAccessToken(isAuthenticated())
  }, [])

  const normalizedProfileData = useMemo<UserProfile | null>(() => {
    if (!profileQueryData) return null

    return {
      id: profileQueryData.id.toString(),
      username: profileQueryData.username,
      email: profileQueryData.email,
      bio: profileQueryData.bio,
      profileImageUrl: profileQueryData.profileImageUrl,
      displayName: profileQueryData.displayName,
      createdAt: profileQueryData.createdAt,
      postsCount: profileQueryData.postsCount || 0,
      followersCount: profileQueryData.followersCount || 0,
      followingCount: profileQueryData.followingCount || 0
    }
  }, [profileQueryData])

  useEffect(() => {
    if (normalizedProfileData) {
      setProfile(normalizedProfileData)
    }
  }, [normalizedProfileData])

  useEffect(() => {
    if (postsQueryData !== undefined) {
      setPosts(postsQueryData)
    }
  }, [postsQueryData])

  useEffect(() => {
    if (!authResolved) {
      setIsLoading(true)
      return
    }

    if (!hasAccessToken) {
      setIsLoading(false)
      return
    }

    if (profileQueryError) {
      if (profileQueryError.message.includes('404')) {
        setError("User not found")
      } else {
        setError("Failed to load user profile")
      }
    } else if (postsQueryError) {
      setError("Failed to load user profile")
    } else {
      setError(null)
    }
    setIsLoading(
      canQueryProfile && (
        profileQueryLoading ||
        postsQueryLoading ||
        (!profileQueryData && !profileQueryError)
      )
    )
  }, [authResolved, canQueryProfile, hasAccessToken, userId, profileQueryData, profileQueryError, postsQueryError, profileQueryLoading, postsQueryLoading])



  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: any) => {
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
    }) as typeof posts)
  }

  const handleRemoveReaction = async (postId: string, reactionSummary?: any) => {
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
    }) as typeof posts)
  }

  const handleShare = (postId: string) => {
    // Share functionality is handled by the PostCard component's ShareModal
    // No additional action needed here
  }

  const handleUserClick = (clickedUserId: string) => {
    if (clickedUserId === currentUser?.id?.toString()) {
      router.push("/profile")
    } else {
      router.push(`/profile/${clickedUserId}`)
    }
  }

  const handleEditPost = (postId: string, updatedPost: any) => {
    // Update the post in the local state
    setPosts(posts.map(post =>
      post.id === postId ? updatedPost : post
    ))
  }

  const handleDeletePost = (postId: string) => {
    // Remove the post from the local state
    setPosts(posts.filter(post => post.id !== postId))
  }

  const handlePostsClick = () => {
    const postsSection = document.getElementById('posts-section')
    if (postsSection) {
      postsSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })

      // Add visual feedback with highlight animation
      setPostsHighlighted(true)
      setTimeout(() => {
        setPostsHighlighted(false)
      }, 2000) // Remove highlight after 2 seconds
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">😔</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
          <button
            onClick={() => router.push('/feed')}
            className="text-purple-600 hover:text-purple-700"
          >
            Go to Feed
          </button>
        </div>
      </div>
    )
  }

  if (!profile) {
    if (!authResolved || (canQueryProfile && !profileQueryError && !profile)) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar
        user={currentUser ? {
          id: currentUser.id,
          name: currentUser.displayName || currentUser.name,
          displayName: currentUser.displayName,
          username: currentUser.username,
          email: currentUser.email,
          profileImageUrl: currentUser.profileImageUrl
        } : undefined}
        onLogout={() => {
          // Use centralized logout from UserContext (handles token removal, notification cleanup, etc.)
          logout()
          router.push("/")
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
              {/* Profile Image */}
              <ProfileImageSection
                photoUrl={profile.profileImageUrl}
                username={profile.username}
                displayName={profile.displayName}
                isOwnProfile={false}
                size="2xl"
              />

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {profile?.displayName || profile?.username || 'Unknown User'}
                </h1>
                {profile?.username && (
                  <p className="text-gray-500 text-sm mb-2">@{profile.username}</p>
                )}

                {profile.bio && (
                  <p className="text-gray-600 mb-4 max-w-md">
                    {profile.bio}
                  </p>
                )}

                <div className="flex items-center justify-center md:justify-start space-x-6 text-sm text-gray-500 mb-4">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Follow Button - only show when viewing someone else's profile */}
                {currentUser && currentUser.id !== profile.id.toString() && (
                  <div className="mb-4">
                    <FollowButton
                      userId={profile.id}
                      size="md"
                      variant="primary"
                      autoFetch={true}
                    // Enable auto-fetch so the button can manage its own follow state
                    // This ensures the button updates properly after follow/unfollow actions
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-center md:justify-start space-x-8">
                  <button
                    className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                    onClick={handlePostsClick}
                    aria-label={`View ${profile.username}'s ${profile.postsCount} posts`}
                    title="Click to view posts"
                  >
                    <div className="text-2xl font-bold text-gray-900">{profile.postsCount}</div>
                    <div className="text-sm text-gray-500">Posts</div>
                  </button>
                  {profile.followersCount !== undefined && (
                    <button
                      className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                      onClick={() => setShowFollowersModal(true)}
                      aria-label={`View ${profile.username}'s ${profile.followersCount} followers`}
                    >
                      <div className="text-2xl font-bold text-gray-900">{profile.followersCount}</div>
                      <div className="text-sm text-gray-500">Followers</div>
                    </button>
                  )}
                  {profile.followingCount !== undefined && (
                    <button
                      className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                      onClick={() => setShowFollowingModal(true)}
                      aria-label={`View ${profile.followingCount} users ${profile.username} is following`}
                    >
                      <div className="text-2xl font-bold text-gray-900">{profile.followingCount}</div>
                      <div className="text-sm text-gray-500">Following</div>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Posts Section */}
          <div
            id="posts-section"
            className={`space-y-6 transition-all duration-500 ${postsHighlighted
              ? 'bg-purple-50 border-2 border-purple-200 rounded-xl p-4 -m-4'
              : ''
              }`}
          >
            <h2 className="text-xl font-semibold text-gray-900">
              {profile.username}'s Gratitude Posts
            </h2>

            {posts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-gray-400 text-4xl mb-4">📝</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-500">
                  {profile.username} hasn't shared any gratitude posts yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUser?.id?.toString()}
                    hideFollowButton={true}
                    onReaction={handleReaction}
                    onRemoveReaction={handleRemoveReaction}
                    onShare={handleShare}
                    onUserClick={handleUserClick}
                    onEdit={handleEditPost}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={profile.id}
        username={profile.displayName || profile.username}
      />

      <FollowingModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        userId={profile.id}
        username={profile.displayName || profile.username}
      />
    </div>
  )
}

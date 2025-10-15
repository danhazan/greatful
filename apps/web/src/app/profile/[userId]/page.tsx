"use client"

import { useState, useEffect } from "react"
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

interface UserProfile {
  id: number
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

interface Post {
  id: string
  content: string
  richContent?: string
  postStyle?: {
    id: string
    name: string
    backgroundColor: string
    backgroundGradient?: string
    textColor: string
    borderStyle?: string
    fontFamily?: string
    textShadow?: string
  }
  author: {
    id: string
    name: string
    username?: string
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
  heartsCount: number
  isHearted: boolean
  reactionsCount: number
  currentUserReaction?: string
}

export default function UserProfilePage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [postsHighlighted, setPostsHighlighted] = useState(false)

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
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) {
          router.push("/auth/login")
          return
        }

        // Get current user info using optimized API client
        let currentUserData: any = null
        try {
          currentUserData = await apiClient.getCurrentUserProfile({ cacheTTL: 300000 }) // 5 minutes cache

          if (currentUserData && currentUserData.id) {
            setCurrentUser({
              id: currentUserData.id,
              name: currentUserData.display_name || currentUserData.name || currentUserData.username,
              display_name: currentUserData.display_name,
              username: currentUserData.username,
              email: currentUserData.email,
              profile_image_url: currentUserData.profile_image_url,
              image: currentUserData.image // Use normalized image field
            })
          }
        } catch (error) {
          console.error('Failed to fetch current user:', error)
        }

        // Fetch user profile using optimized API client (skip cache to get fresh data)
        let profileData: any
        try {
          profileData = await apiClient.getUserProfile(userId, { skipCache: true })
        } catch (error) {
          if (error instanceof Error && error.message.includes('404')) {
            setError("User not found")
          } else {
            setError("Failed to load user profile")
          }
          return
        }

        console.log('Profile data received:', profileData)

        // Ensure we use the correct field names from API response
        const followersCount = profileData.followers_count ?? profileData.followersCount ?? 0
        const followingCount = profileData.following_count ?? profileData.followingCount ?? 0

        console.log('API Response - Setting profile with follower counts:', {
          raw_followers_count: profileData.followers_count,
          raw_following_count: profileData.following_count,
          finalFollowersCount: followersCount,
          finalFollowingCount: followingCount,
          userId: profileData.id,
          username: profileData.username
        })

        setProfile({
          id: profileData.id,
          username: profileData.username,
          email: profileData.email,
          bio: profileData.bio,
          profileImageUrl: profileData.profile_image_url,
          displayName: profileData.display_name,
          createdAt: profileData.created_at,
          postsCount: profileData.posts_count || 0,
          followersCount: followersCount,
          followingCount: followingCount
        })

        console.log('Profile state set with counts:', {
          followersCount: followersCount,
          followingCount: followingCount
        })

        console.log('Profile state set:', {
          username: profileData.username,
          displayName: profileData.display_name,
          profileImageUrl: profileData.profile_image_url
        })

        // Fetch user posts using optimized API client
        try {
          let postsData
          if (userId === currentUserData?.id?.toString()) {
            // For current user, use the existing me/posts endpoint
            postsData = await apiClient.get('/users/me/posts')
          } else {
            // For other users, try the dedicated endpoint first
            try {
              console.log('Fetching posts for userId:', userId)
              postsData = await apiClient.getUserPosts(userId)
              console.log('Successfully fetched user posts:', Array.isArray(postsData) ? postsData.length : 0)
            } catch (userPostsError) {
              // Don't use fallback that loads all posts - this causes multiple user requests
              console.warn('Failed to fetch user posts, no fallback used to prevent multiple user requests:', userPostsError)
              postsData = [] // Just show empty posts instead of loading all posts
            }
          }

          // Transform posts from backend format to frontend format
          const transformedPosts = Array.isArray(postsData) ? transformUserPosts(postsData) : []
          // Sort posts by creation date (newest first) as a backup
          const sortedPosts = transformedPosts.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          setPosts(sortedPosts)
        } catch (postsError) {
          console.error('Error fetching posts:', postsError)
          // Don't fail the whole page if posts can't be loaded
          setPosts([])
        }

      } catch (error) {
        console.error('Error fetching user profile:', error)
        setError("Failed to load user profile")
      } finally {
        setIsLoading(false)
      }
    }

    if (userId) {
      fetchUserProfile()
    }
  }, [userId, router])

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: { hearts_count: number, is_hearted: boolean }) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newHearted = heartInfo ? heartInfo.is_hearted : !isCurrentlyHearted
    const newCount = heartInfo ? heartInfo.hearts_count : (isCurrentlyHearted ? (posts.find(p => p.id === postId)?.heartsCount || 1) - 1 : (posts.find(p => p.id === postId)?.heartsCount || 0) + 1)

    // Update both the user's individual heart state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          heartsCount: newCount,
          // Update user's individual heart state
          isHearted: newHearted
        }
      }
      return post
    }))
  }

  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: { total_count: number, reactions: { [key: string]: number }, user_reaction: string | null }) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newReaction = reactionSummary ? reactionSummary.user_reaction : emojiCode
    const newCount = reactionSummary ? reactionSummary.total_count : (posts.find(p => p.id === postId)?.reactionsCount || 0) + 1

    // Update both the user's individual reaction state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          reactionsCount: newCount,
          // Update user's individual reaction state
          currentUserReaction: newReaction as string | undefined
        }
      }
      return post
    }) as typeof posts)
  }

  const handleRemoveReaction = async (postId: string, reactionSummary?: { total_count: number, reactions: { [key: string]: number }, user_reaction: string | null }) => {
    // If we have server data, use it; otherwise fallback to optimistic update
    const newReaction = reactionSummary ? reactionSummary.user_reaction : undefined
    const newCount = reactionSummary ? reactionSummary.total_count : Math.max((posts.find(p => p.id === postId)?.reactionsCount || 1) - 1, 0)

    // Update both the user's individual reaction state AND the global count from server
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          // Update global count with server data (server-authoritative)
          reactionsCount: newCount,
          // Clear user's individual reaction state
          currentUserReaction: newReaction as string | undefined
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
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar
        user={currentUser}
        onLogout={() => {
          localStorage.removeItem("access_token")
          setCurrentUser(null)
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
                {currentUser && currentUser.id !== profile.id && (
                  <div className="mb-4">
                    <FollowButton
                      userId={profile.id}
                      size="md"
                      variant="primary"
                      autoFetch={false}
                      // Disable auto-fetch since parent component already fetched profile
                      // This prevents duplicate API calls to the same user profile endpoint
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
                    onHeart={handleHeart}
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
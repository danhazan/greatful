"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Calendar } from "lucide-react"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"

interface UserProfile {
  id: number
  username: string
  email: string
  bio?: string
  profileImageUrl?: string
  createdAt: string
  postsCount: number
  followersCount?: number
  followingCount?: number
}

interface Post {
  id: string
  content: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
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

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("access_token")
        if (!token) {
          router.push("/auth/login")
          return
        }

        // Get current user info
        let currentUserData = null
        const currentUserResponse = await fetch('/api/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (currentUserResponse.ok) {
          currentUserData = await currentUserResponse.json()
          setCurrentUser({
            id: currentUserData.id,
            name: currentUserData.username,
            email: currentUserData.email
          })
        }

        // Fetch user profile
        const profileResponse = await fetch(`/api/users/${userId}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!profileResponse.ok) {
          if (profileResponse.status === 404) {
            setError("User not found")
          } else {
            setError("Failed to load user profile")
          }
          return
        }

        const profileData = await profileResponse.json()
        setProfile({
          id: profileData.id,
          username: profileData.username,
          email: profileData.email,
          bio: profileData.bio,
          profileImageUrl: profileData.profile_image_url,
          createdAt: profileData.created_at,
          postsCount: profileData.posts_count || 0,
          followersCount: profileData.followers_count || 0,
          followingCount: profileData.following_count || 0
        })

        // Fetch user posts
        try {
          if (userId === currentUserData?.id?.toString()) {
            // For current user, use the existing me/posts endpoint
            const postsResponse = await fetch('/api/users/me/posts', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            if (postsResponse.ok) {
              const postsData = await postsResponse.json()
              setPosts(postsData)
            }
          } else {
            // For other users, try the dedicated endpoint first
            const userPostsResponse = await fetch(`/api/users/${userId}/posts`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            })
            
            if (userPostsResponse.ok) {
              const userPostsData = await userPostsResponse.json()
              setPosts(userPostsData)
            } else {
              // Fallback: get all posts from feed and filter by author
              const feedResponse = await fetch('/api/posts', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              })
              if (feedResponse.ok) {
                const allPosts = await feedResponse.json()
                const userPosts = allPosts.filter((post: any) => post.author.id === userId)
                console.log('Filtered user posts:', userPosts)
                setPosts(userPosts)
              }
            }
          }
        } catch (postsError) {
          console.error('Error fetching posts:', postsError)
          // Don't fail the whole page if posts can't be loaded
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

  const handleHeart = (postId: string, isCurrentlyHearted: boolean, heartInfo?: {hearts_count: number, is_hearted: boolean}) => {
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

  const handleReaction = async (postId: string, emojiCode: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
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

  const handleRemoveReaction = async (postId: string, reactionSummary?: {total_count: number, reactions: {[key: string]: number}, user_reaction: string | null}) => {
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
    alert(`Share functionality for post ${postId} - Coming soon!`)
  }

  const handleUserClick = (clickedUserId: string) => {
    if (clickedUserId === currentUser?.id) {
      router.push("/profile")
    } else {
      router.push(`/profile/${clickedUserId}`)
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
            onClick={() => router.back()}
            className="text-purple-600 hover:text-purple-700"
          >
            Go back
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
      <Navbar user={currentUser} showBackButton={true} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
              {/* Profile Image */}
              <div className="flex-shrink-0">
                {profile.profileImageUrl ? (
                  <img
                    src={profile?.profileImageUrl}
                    alt={profile?.username || 'User'}
                    className="w-32 h-32 rounded-full object-cover border-4 border-purple-100"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-purple-100 flex items-center justify-center border-4 border-purple-200">
                    <span className="text-4xl font-bold text-purple-600">
                      {profile?.username?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {profile?.username || 'Unknown User'}
                </h1>
                
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

                {/* Stats */}
                <div className="flex items-center justify-center md:justify-start space-x-8">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{profile.postsCount}</div>
                    <div className="text-sm text-gray-500">Posts</div>
                  </div>
                  {profile.followersCount !== undefined && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{profile.followersCount}</div>
                      <div className="text-sm text-gray-500">Followers</div>
                    </div>
                  )}
                  {profile.followingCount !== undefined && (
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{profile.followingCount}</div>
                      <div className="text-sm text-gray-500">Following</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Posts Section */}
          <div className="space-y-6">
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
                    currentUserId={currentUser?.id}
                    onHeart={handleHeart}
                    onReaction={handleReaction}
                    onRemoveReaction={handleRemoveReaction}
                    onShare={handleShare}
                    onUserClick={handleUserClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
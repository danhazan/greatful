"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Edit3, Calendar, Heart } from "lucide-react"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"

interface UserProfile {
  id: number
  username: string
  email: string
  bio?: string
  profileImage?: string
  joinDate: string
  postsCount: number
  followersCount: number
  followingCount: number
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

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    username: "",
    bio: ""
  })
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Load user profile data
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const profileData = await response.json()
          const userProfile: UserProfile = {
            id: profileData.id,
            username: profileData.username,
            email: profileData.email,
            bio: profileData.bio || "No bio yet - add one by editing your profile!",
            joinDate: profileData.created_at,
            postsCount: profileData.posts_count,
            followersCount: profileData.followers_count,
            followingCount: profileData.following_count
          }

          setUser(userProfile)
          setCurrentUser({
            id: userProfile.id,
            name: userProfile.username,
            email: userProfile.email
          })
          setEditForm({
            username: userProfile.username,
            bio: userProfile.bio || ""
          })

          // Fetch user's posts
          const postsResponse = await fetch('/api/users/me/posts', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (postsResponse.ok) {
            const userPosts = await postsResponse.json()
            setPosts(userPosts)
          } else {
            console.error('Failed to fetch user posts')
            setPosts([])
          }
        } else {
          console.error('Failed to fetch profile')
          router.push("/auth/login")
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
        router.push("/auth/login")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  const handleEditProfile = () => {
    setIsEditing(true)
  }

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    try {
      const response = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: editForm.username,
          bio: editForm.bio
        })
      })

      if (response.ok) {
        const updatedProfile = await response.json()
        if (user) {
          setUser({
            ...user,
            username: updatedProfile.username,
            bio: updatedProfile.bio || ""
          })
        }
        setIsEditing(false)
      } else {
        const error = await response.json()
        alert(error.detail || "Failed to update profile")
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert("Failed to update profile")
    }
  }

  const handleCancelEdit = () => {
    if (user) {
      setEditForm({
        username: user.username,
        bio: user.bio || ""
      })
    }
    setIsEditing(false)
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          heartsCount: isCurrentlyHearted ? (post.heartsCount || 1) - 1 : (post.heartsCount || 0) + 1,
          isHearted: !isCurrentlyHearted
        }
      }
      return post
    }))
  }

  const handleReaction = (postId: string, emojiCode: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const wasReacted = !!post.currentUserReaction
        return {
          ...post,
          reactionsCount: wasReacted ? post.reactionsCount || 1 : (post.reactionsCount || 0) + 1,
          currentUserReaction: emojiCode
        }
      }
      return post
    }))
  }

  const handleRemoveReaction = (postId: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          reactionsCount: Math.max(0, (post.reactionsCount || 1) - 1),
          currentUserReaction: undefined
        }
      }
      return post
    }))
  }

  const handleShare = (postId: string) => {
    alert(`Share functionality for post ${postId} - Coming in TASK 3!`)
  }

  const handleUserClick = () => {
    // Stay on current profile since it's the user's own profile
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Profile not found</p>
        </div>
      </div>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar user={currentUser} onLogout={handleLogout} />

      {/* Profile Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-6">
                {/* Profile Image */}
                <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center">
                  {user.profileImage ? (
                    <img 
                      src={user.profileImage} 
                      alt={user.username}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-purple-600" />
                  )}
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={30}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bio
                        </label>
                        <textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={3}
                          maxLength={150}
                          placeholder="Tell us about yourself..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editForm.bio.length}/150 characters
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {user.username}
                      </h1>
                      {user.bio && (
                        <p className="text-gray-600 mb-4 text-lg">
                          {user.bio}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>Joined {formatDate(user.joinDate)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Edit Button */}
              <div className="flex space-x-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleEditProfile}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Edit Profile</span>
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-8 mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{user.postsCount}</div>
                <div className="text-sm text-gray-500">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{user.followersCount}</div>
                <div className="text-sm text-gray-500">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{user.followingCount}</div>
                <div className="text-sm text-gray-500">Following</div>
              </div>
            </div>
          </div>

          {/* Posts Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Your Posts</h2>
            
            {posts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posts yet</h3>
                <p className="text-gray-500 mb-6">
                  Start sharing what you're grateful for!
                </p>
                <button
                  onClick={() => router.push("/feed")}
                  className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Your First Post
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onHeart={handleHeart}
                  onReaction={handleReaction}
                  onRemoveReaction={handleRemoveReaction}
                  onShare={handleShare}
                  onUserClick={handleUserClick}
                />
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
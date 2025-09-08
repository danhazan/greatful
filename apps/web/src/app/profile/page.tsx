"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Edit3, Calendar, Heart, X, Plus, Trash2, MapPin, Building, Globe } from "lucide-react"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload"
import ProfileImageSection from "@/components/ProfileImageSection"
import LocationAutocomplete from "@/components/LocationAutocomplete"
import { transformUserPosts } from "@/lib/transformers"

interface UserProfile {
  id: number
  username: string
  email: string
  bio?: string
  profileImage?: string
  displayName?: string
  city?: string
  location?: {
    display_name: string
    lat: number
    lon: number
    address?: any
  }
  institutions?: string[]
  websites?: string[]
  joinDate: string
  postsCount: number
  followersCount: number
  followingCount: number
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

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    username: "",
    bio: "",
    displayName: "",
    city: "",
    institutions: [] as string[],
    websites: [] as string[]
  })
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // State for managing pending institutions and websites
  const [pendingInstitution, setPendingInstitution] = useState("")
  const [pendingWebsite, setPendingWebsite] = useState("")
  const [institutionError, setInstitutionError] = useState("")
  const [websiteError, setWebsiteError] = useState("")
  const [originalLocation, setOriginalLocation] = useState<any>(null)

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
          const responseData = await response.json()
          const profileData = responseData.data || responseData // Handle both wrapped and unwrapped responses
          const userProfile: UserProfile = {
            id: profileData.id,
            username: profileData.username || 'Unknown User',
            email: profileData.email,
            bio: profileData.bio || "No bio yet - add one by editing your profile!",
            profileImage: profileData.profile_image_url,
            displayName: profileData.display_name,
            city: profileData.city,
            location: profileData.location,
            institutions: profileData.institutions || [],
            websites: profileData.websites || [],
            joinDate: profileData.created_at || new Date().toISOString(),
            postsCount: profileData.posts_count || 0,
            followersCount: profileData.followers_count || 0,
            followingCount: profileData.following_count || 0
          }

          setUser(userProfile)
          setCurrentUser({
            id: userProfile.id,
            name: userProfile.displayName || userProfile.username,
            email: userProfile.email
          })
          setEditForm({
            username: userProfile.username,
            bio: userProfile.bio || "",
            displayName: userProfile.displayName || "",
            city: userProfile.city || "",
            institutions: Array.isArray(userProfile.institutions) ? userProfile.institutions : [],
            websites: Array.isArray(userProfile.websites) ? userProfile.websites : []
          })
          setSelectedLocation(userProfile.location)

          // Fetch user's posts
          const postsResponse = await fetch('/api/users/me/posts', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (postsResponse.ok) {
            const postsResponseData = await postsResponse.json()
            const userPosts = postsResponseData.data || postsResponseData // Handle both wrapped and unwrapped responses
            // Transform posts from backend format to frontend format
            const transformedPosts = Array.isArray(userPosts) ? transformUserPosts(userPosts) : []
            // Sort posts by creation date (newest first) as a backup
            const sortedPosts = transformedPosts.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
            setPosts(sortedPosts)
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
    // Store original location for validation
    setOriginalLocation(selectedLocation)
    // Clear pending fields and errors
    setPendingInstitution("")
    setPendingWebsite("")
    setInstitutionError("")
    setWebsiteError("")
  }

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    // Validate location - if there's text but no valid location selected, revert to original
    let locationToSave = selectedLocation
    if (editForm.city && editForm.city.trim() && !selectedLocation) {
      // User typed something but didn't select from autocomplete - revert to original
      locationToSave = originalLocation
      setSelectedLocation(originalLocation)
      setEditForm({
        ...editForm,
        city: originalLocation ? originalLocation.display_name : ""
      })
      alert("Please select a location from the dropdown or leave the field empty")
      return
    }

    try {
      // Build request body, only including fields that have valid values
      const requestBody: any = {}
      
      // Username is required and must be at least 3 characters
      if (editForm.username && editForm.username.trim().length >= 3) {
        requestBody.username = editForm.username.trim()
      }
      
      // Bio can be empty
      requestBody.bio = editForm.bio || ""
      
      // Display name must be at least 1 character if provided
      if (editForm.displayName && editForm.displayName.trim().length >= 1) {
        requestBody.display_name = editForm.displayName.trim()
      }
      
      // City can be empty
      if (editForm.city && editForm.city.trim()) {
        requestBody.city = editForm.city.trim()
      }
      
      // Location data
      if (locationToSave) {
        requestBody.location_data = locationToSave
      }
      
      // Institutions and websites
      requestBody.institutions = Array.isArray(editForm.institutions) ? editForm.institutions.filter(inst => inst && inst.trim()) : []
      requestBody.websites = Array.isArray(editForm.websites) ? editForm.websites.filter(url => url && url.trim()) : []
      
      console.log('Sending profile update request:', requestBody)
      
      const response = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      })

      const responseData = await response.json()

      if (response.ok) {
        const updatedProfileData = responseData.data || responseData
        if (user) {
          setUser({
            ...user,
            username: updatedProfileData.username,
            bio: updatedProfileData.bio || "",
            displayName: updatedProfileData.display_name,
            city: updatedProfileData.city,
            location: updatedProfileData.location,
            institutions: updatedProfileData.institutions || [],
            websites: updatedProfileData.websites || []
          })
        }
        setIsEditing(false)
        // Clear pending fields
        setPendingInstitution("")
        setPendingWebsite("")
        setInstitutionError("")
        setWebsiteError("")
      } else {
        console.error('Profile update error response:', response.status, response.statusText)
        console.error('Profile update error data:', responseData)
        
        let errorMessage = "Failed to update profile"
        if (responseData.detail) {
          if (typeof responseData.detail === 'string') {
            errorMessage = responseData.detail
          } else if (Array.isArray(responseData.detail)) {
            errorMessage = responseData.detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
          } else {
            errorMessage = JSON.stringify(responseData.detail)
          }
        } else if (responseData.error) {
          errorMessage = responseData.error
        }
        
        alert(`Error (${response.status}): ${errorMessage}`)
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
        bio: user.bio || "",
        displayName: user.displayName || "",
        city: user.city || "",
        institutions: Array.isArray(user.institutions) ? user.institutions : [],
        websites: Array.isArray(user.websites) ? user.websites : []
      })
      setSelectedLocation(user.location)
    }
    setIsEditing(false)
    // Clear pending fields and errors
    setPendingInstitution("")
    setPendingWebsite("")
    setInstitutionError("")
    setWebsiteError("")
  }

  const handleHeart = (postId: string, isCurrentlyHearted: boolean) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          heartsCount: isCurrentlyHearted ? Math.max(0, post.heartsCount - 1) : post.heartsCount + 1,
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
    // Share functionality is handled by the PostCard component's ShareModal
    // No additional action needed here
  }

  const handleUserClick = () => {
    // Stay on current profile since it's the user's own profile
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

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
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

  const handlePhotoUpdate = (photoUrl: string | null) => {
    if (user) {
      setUser({
        ...user,
        profileImage: photoUrl || undefined
      })
    }
    setShowPhotoUpload(false)
  }

  // Helper functions for managing institutions and websites
  const addInstitution = () => {
    const trimmed = pendingInstitution.trim()
    if (!trimmed) {
      setInstitutionError("Institution name cannot be empty")
      return
    }
    
    const institutions = Array.isArray(editForm.institutions) ? editForm.institutions : []
    if (institutions.length >= 10) {
      setInstitutionError("Maximum 10 institutions allowed")
      return
    }

    if (institutions.includes(trimmed)) {
      setInstitutionError("Institution already added")
      return
    }

    setEditForm({
      ...editForm,
      institutions: [...institutions, trimmed]
    })
    setPendingInstitution("")
    setInstitutionError("")
  }

  const removeInstitution = (index: number) => {
    const institutions = Array.isArray(editForm.institutions) ? editForm.institutions : []
    const newInstitutions = institutions.filter((_, i) => i !== index)
    setEditForm({
      ...editForm,
      institutions: newInstitutions
    })
  }

  const addWebsite = () => {
    const trimmed = pendingWebsite.trim()
    if (!trimmed) {
      setWebsiteError("Website URL cannot be empty")
      return
    }

    // Normalize URL (add https:// if not present)
    const normalizedUrl = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`

    // Strict URL validation to match backend requirements
    const urlPattern = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/?|[\/\?]\S+)$/i
    
    if (!urlPattern.test(normalizedUrl)) {
      setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)")
      return
    }

    // Additional validation using URL constructor
    try {
      const url = new URL(normalizedUrl)
      // Check for valid hostname (no @ symbols, allow localhost or domains with dots)
      if (url.hostname.includes('@') || (!url.hostname.includes('.') && url.hostname !== 'localhost')) {
        throw new Error("Invalid hostname")
      }
    } catch {
      setWebsiteError("Please enter a valid website URL (e.g., example.com or https://example.com)")
      return
    }
    
    const websites = Array.isArray(editForm.websites) ? editForm.websites : []
    if (websites.length >= 5) {
      setWebsiteError("Maximum 5 websites allowed")
      return
    }

    if (websites.includes(normalizedUrl)) {
      setWebsiteError("Website already added")
      return
    }

    setEditForm({
      ...editForm,
      websites: [...websites, normalizedUrl]
    })
    setPendingWebsite("")
    setWebsiteError("")
  }

  const removeWebsite = (index: number) => {
    const websites = Array.isArray(editForm.websites) ? editForm.websites : []
    const newWebsites = websites.filter((_, i) => i !== index)
    setEditForm({
      ...editForm,
      websites: newWebsites
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar user={currentUser} onLogout={handleLogout} />

      {/* Profile Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-8 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 w-full">
                {/* Profile Image */}
                <ProfileImageSection
                  photoUrl={user.profileImage}
                  username={user.username}
                  displayName={user.displayName}
                  isOwnProfile={true}
                  onPhotoClick={() => setShowPhotoUpload(true)}
                  size="xl"
                />

                {/* Profile Info */}
                <div className="flex-1 text-center sm:text-left min-w-0">
                  {isEditing ? (
                    <div className="space-y-4 max-w-2xl">
                      {/* Display Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={100}
                          placeholder="How you want to be displayed"
                        />
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          maxLength={50}
                        />
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bio
                        </label>
                        <textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          rows={3}
                          maxLength={500}
                          placeholder="Tell us about yourself..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {editForm.bio.length}/500 characters
                        </p>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <LocationAutocomplete
                          value={editForm.city}
                          onChange={(value) => setEditForm({ ...editForm, city: value })}
                          onLocationSelect={(location) => setSelectedLocation(location)}
                          placeholder="Enter city, neighborhood, or place..."
                        />
                        {selectedLocation && (
                          <p className="text-xs text-gray-500 mt-1">
                            Selected: {selectedLocation.display_name}
                          </p>
                        )}
                      </div>

                      {/* Institutions */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Institutions (School, Company, Foundation)
                        </label>
                        <div className="space-y-2">
                          {/* Existing institutions */}
                          {Array.isArray(editForm.institutions) && editForm.institutions.map((institution, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                                {String(institution)}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeInstitution(index)}
                                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                                title="Remove institution"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          
                          {/* Add new institution */}
                          {Array.isArray(editForm.institutions) && editForm.institutions.length < 10 && (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <input
                                  type="text"
                                  value={pendingInstitution}
                                  onChange={(e) => {
                                    setPendingInstitution(e.target.value)
                                    setInstitutionError("")
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && pendingInstitution.trim()) {
                                      addInstitution()
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  maxLength={100}
                                  placeholder="Institution name"
                                />
                                <button
                                  type="button"
                                  onClick={addInstitution}
                                  disabled={!pendingInstitution.trim()}
                                  className="p-2 text-purple-600 hover:text-purple-700 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title="Save institution"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                                  </svg>
                                </button>
                              </div>
                              {institutionError && (
                                <p className="text-xs text-red-600 ml-6">{institutionError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Websites */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Websites
                        </label>
                        <div className="space-y-2">
                          {/* Existing websites */}
                          {Array.isArray(editForm.websites) && editForm.websites.map((website, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                                {String(website)}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeWebsite(index)}
                                className="p-2 text-red-500 hover:text-red-700 transition-colors"
                                title="Remove website"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          
                          {/* Add new website */}
                          {Array.isArray(editForm.websites) && editForm.websites.length < 5 && (
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Globe className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <input
                                  type="url"
                                  value={pendingWebsite}
                                  onChange={(e) => {
                                    setPendingWebsite(e.target.value)
                                    setWebsiteError("")
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && pendingWebsite.trim()) {
                                      addWebsite()
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="https://example.com"
                                />
                                <button
                                  type="button"
                                  onClick={addWebsite}
                                  disabled={!pendingWebsite.trim()}
                                  className="p-2 text-purple-600 hover:text-purple-700 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
                                  title="Save website"
                                >
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                                  </svg>
                                </button>
                              </div>
                              {websiteError && (
                                <p className="text-xs text-red-600 ml-6">{websiteError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 truncate">
                        {user.displayName || user.username}
                      </h1>
                      {user.username && (
                        <p className="text-gray-500 text-sm mb-2">@{user.username}</p>
                      )}
                      {user.bio && (
                        <p className="text-gray-600 mb-4 text-sm sm:text-lg break-words">
                          {user.bio}
                        </p>
                      )}
                      
                      {/* Location Display */}
                      {user.location && user.location.display_name && (
                        <div className="flex items-center space-x-2 mb-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 text-sm">{user.location.display_name}</span>
                        </div>
                      )}

                      {/* Institutions Display */}
                      {user.institutions && Array.isArray(user.institutions) && user.institutions.length > 0 && (
                        <div className="mb-2">
                          {user.institutions.map((institution, index) => (
                            <div key={index} className="flex items-center space-x-2 mb-1">
                              <Building className="h-4 w-4 text-gray-500" />
                              <span className="text-gray-600 text-sm">{String(institution)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Websites Display */}
                      {user.websites && Array.isArray(user.websites) && user.websites.length > 0 && (
                        <div className="mb-4">
                          {user.websites.map((website, index) => (
                            <div key={index} className="flex items-center space-x-2 mb-1">
                              <Globe className="h-4 w-4 text-gray-500" />
                              <a
                                href={String(website)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-600 hover:text-purple-700 text-sm underline"
                              >
                                {String(website).replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-center sm:justify-start space-x-4 text-xs sm:text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span>Joined {formatDate(user.joinDate)}</span>
                        </div>
                      </div>

                      {/* Edit Profile Button - positioned below "Joined..." text */}
                      {!isEditing && (
                        <div className="mt-4 flex justify-center sm:justify-start">
                          <button
                            onClick={handleEditProfile}
                            className="flex items-center space-x-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm min-h-[44px] touch-manipulation"
                          >
                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Edit Profile</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Cancel/Save Buttons - positioned below profile details when editing */}
                  {isEditing && (
                    <div className="mt-6 flex space-x-2 justify-center sm:justify-start">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm min-h-[44px] touch-manipulation"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm min-h-[44px] touch-manipulation"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center sm:justify-start space-x-6 sm:space-x-8 mt-6 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.postsCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Posts</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.followersCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.followingCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Following</div>
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
              ))
            )}
          </div>
        </div>
      </main>

      {/* Profile Photo Upload Modal */}
      {showPhotoUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Update Profile Photo</h3>
              <button
                onClick={() => setShowPhotoUpload(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <ProfilePhotoUpload
              currentPhotoUrl={user.profileImage}
              onPhotoUpdate={handlePhotoUpdate}
            />
          </div>
        </div>
      )}
    </div>
  )
}
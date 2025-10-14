"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { User, Edit3, Calendar, Heart, X, Plus, Trash2, MapPin, Building, Globe, Shield, Eye, EyeOff } from "lucide-react"
import PostCard from "@/components/PostCard"
import Navbar from "@/components/Navbar"
import ProfilePhotoUpload from "@/components/ProfilePhotoUpload"
import ProfileImageSection from "@/components/ProfileImageSection"
import LocationAutocomplete from "@/components/LocationAutocomplete"
import FollowersModal from "@/components/FollowersModal"
import FollowingModal from "@/components/FollowingModal"
import { transformUserPosts } from "@/lib/transformers"
import { normalizeUserData } from "@/utils/userDataMapping"
import { getCompleteInputStyling } from "@/utils/inputStyles"
import { stateSyncUtils } from "@/utils/stateSynchronization"

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
  oauth_provider?: string | null
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
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [isEditingAccount, setIsEditingAccount] = useState(false)
  const [profileEditForm, setProfileEditForm] = useState({
    bio: "",
    displayName: "",
    city: "",
    institutions: [] as string[],
    websites: [] as string[]
  })
  const [accountEditForm, setAccountEditForm] = useState({
    username: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  })
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // State for managing pending institutions and websites
  const [pendingInstitution, setPendingInstitution] = useState("")
  const [pendingWebsite, setPendingWebsite] = useState("")
  const [institutionError, setInstitutionError] = useState("")
  const [websiteError, setWebsiteError] = useState("")
  const [usernameError, setUsernameError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isUsernameEditable, setIsUsernameEditable] = useState(false)
  const [isPasswordSectionOpen, setIsPasswordSectionOpen] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [originalLocation, setOriginalLocation] = useState<any>(null)
  const [showFollowersModal, setShowFollowersModal] = useState(false)
  const [showFollowingModal, setShowFollowingModal] = useState(false)
  const [postsHighlighted, setPostsHighlighted] = useState(false)
  const usernameInputRef = useRef<HTMLInputElement>(null)
  const passwordSectionRef = useRef<HTMLDivElement>(null)

  // Listen for follower count updates from other users following/unfollowing this user
  useEffect(() => {
    const handleFollowerCountUpdate = (e: CustomEvent) => {
      if (user && e.detail.userId === user.id.toString()) {
        setUser(prev => prev ? {
          ...prev,
          followersCount: e.detail.isFollowing 
            ? (prev.followersCount || 0) + 1 
            : Math.max(0, (prev.followersCount || 0) - 1)
        } : null)
      }
    }

    window.addEventListener('followerCountUpdate', handleFollowerCountUpdate as EventListener)
    return () => window.removeEventListener('followerCountUpdate', handleFollowerCountUpdate as EventListener)
  }, [user])

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
          const rawProfileData = responseData.data || responseData // Handle both wrapped and unwrapped responses
          
          // Normalize user data to ensure consistent field names and absolute URLs
          const profileData = normalizeUserData(rawProfileData)
          
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
            followingCount: profileData.following_count || 0,
            oauth_provider: profileData.oauth_provider || null
          }

          setUser(userProfile)
          setCurrentUser({
            id: userProfile.id,
            name: userProfile.displayName || userProfile.username,
            display_name: userProfile.displayName,
            username: userProfile.username,
            email: userProfile.email,
            profile_image_url: profileData.profile_image_url,
            image: profileData.image // Use normalized image field
          })
          setProfileEditForm({
            bio: userProfile.bio || "",
            displayName: userProfile.displayName || "",
            city: userProfile.city || "",
            institutions: Array.isArray(userProfile.institutions) ? userProfile.institutions : [],
            websites: Array.isArray(userProfile.websites) ? userProfile.websites : []
          })
          setAccountEditForm({
            username: userProfile.username,
            currentPassword: "",
            newPassword: "",
            confirmPassword: ""
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
    setIsEditingProfile(true)
    setIsEditingAccount(false)
    setOriginalLocation(selectedLocation)
    setPendingInstitution("")
    setPendingWebsite("")
    setInstitutionError("")
    setWebsiteError("")
  }

  const handleEditAccount = () => {
    setIsEditingAccount(true)
    setIsEditingProfile(false)
    setUsernameError("")
    setPasswordError("")
    setIsUsernameEditable(false)
    setIsPasswordSectionOpen(false)
  }

  const handleSaveProfile = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    // Validate location - if there's text but no valid location selected, revert to original
    let locationToSave = selectedLocation
    if (profileEditForm.city && profileEditForm.city.trim() && !selectedLocation) {
      // User typed something but didn't select from autocomplete - revert to original
      locationToSave = originalLocation
      setSelectedLocation(originalLocation)
      setProfileEditForm({
        ...profileEditForm,
        city: originalLocation ? originalLocation.display_name : ""
      })
      alert("Please select a location from the dropdown or leave the field empty")
      return
    }

    try {
      // Build request body, only including fields that have valid values
      const requestBody: any = {}
      
      // Bio can be empty
      requestBody.bio = profileEditForm.bio || ""
      
      // Display name must be at least 1 character if provided
      if (profileEditForm.displayName && profileEditForm.displayName.trim().length >= 1) {
        requestBody.display_name = profileEditForm.displayName.trim()
      }
      
      // City can be empty
      if (profileEditForm.city && profileEditForm.city.trim()) {
        requestBody.city = profileEditForm.city.trim()
      }
      
      // Location data
      if (locationToSave) {
        requestBody.location_data = locationToSave
      }
      
      // Institutions and websites
      requestBody.institutions = Array.isArray(profileEditForm.institutions) ? profileEditForm.institutions.filter(inst => inst && inst.trim()) : []
      requestBody.websites = Array.isArray(profileEditForm.websites) ? profileEditForm.websites.filter(url => url && url.trim()) : []
      
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
          const updatedUser = {
            ...user,
            bio: updatedProfileData.bio || "",
            displayName: updatedProfileData.display_name,
            city: updatedProfileData.city,
            location: updatedProfileData.location,
            institutions: updatedProfileData.institutions || [],
            websites: updatedProfileData.websites || []
          }
          setUser(updatedUser)
          
          // Emit global state synchronization event
          stateSyncUtils.updateUserProfile(user.id.toString(), {
            display_name: updatedProfileData.display_name,
            name: updatedProfileData.display_name,
            bio: updatedProfileData.bio,
            city: updatedProfileData.city,
            location: updatedProfileData.location,
            institutions: updatedProfileData.institutions,
            websites: updatedProfileData.websites
          })
        }
        setIsEditingProfile(false)
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
        
        if (errorMessage) {
          alert(`Error (${response.status}): ${errorMessage}`)
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert("Failed to update profile")
    }
  }

  const handleSaveAccount = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) return

    let hasErrors = false
    setUsernameError("")
    setPasswordError("")

    // Handle username change
    if (isUsernameEditable && user && accountEditForm.username !== user.username) {
      // Validate username
      if (!accountEditForm.username || accountEditForm.username.trim().length < 3) {
        setUsernameError("Username must be at least 3 characters long")
        usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        hasErrors = true
      } else if (!/^[a-zA-Z0-9_]+$/.test(accountEditForm.username)) {
        setUsernameError("Username can only contain letters, numbers, and underscores")
        usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        hasErrors = true
      } else {
      try {
        const response = await fetch('/api/users/me/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ username: accountEditForm.username })
        })

        if (!response.ok) {
          const errorData = await response.json()
          setUsernameError(errorData.detail || "Failed to update username")
          usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          hasErrors = true
        } else {
          const updatedData = await response.json()
          if (user) {
            const updatedUser = { ...user, username: updatedData.data.username }
            setUser(updatedUser)
          }
        }
      } catch (error) {
        setUsernameError("An unexpected error occurred")
        usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        hasErrors = true
      }
      }
    }

    // Handle password change
    if (isPasswordSectionOpen && accountEditForm.newPassword) {
      // Validate passwords
      if (!accountEditForm.currentPassword) {
        setPasswordError("Current password is required")
        passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      
      if (accountEditForm.newPassword.length < 6) {
        setPasswordError("New password must be at least 6 characters long")
        passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      
      if (accountEditForm.newPassword !== accountEditForm.confirmPassword) {
        setPasswordError("New passwords do not match")
        passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }

      try {
        const response = await fetch('/api/users/me/password', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            current_password: accountEditForm.currentPassword,
            new_password: accountEditForm.newPassword
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          setPasswordError(errorData.detail || "Failed to update password")
          passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          hasErrors = true
        } else {
          // Trigger browser password manager to save new password
          setTimeout(() => {
            const hiddenForm = document.getElementById('password-manager-form') as HTMLFormElement
            if (hiddenForm && user) {
              const usernameInput = hiddenForm.querySelector('input[name="username"]') as HTMLInputElement
              const passwordInput = hiddenForm.querySelector('input[name="password"]') as HTMLInputElement
              if (usernameInput && passwordInput) {
                usernameInput.value = user.username
                passwordInput.value = accountEditForm.newPassword
                // Submit the form to trigger password manager
                hiddenForm.submit()
              }
            }
          }, 100)
        }
      } catch (error) {
        setPasswordError("An unexpected error occurred")
        passwordSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        hasErrors = true
      }
    }

    if (!hasErrors) {
      setIsEditingAccount(false)
      setIsUsernameEditable(false)
      setIsPasswordSectionOpen(false)
      setAccountEditForm({
        ...accountEditForm,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      })
    }
  }

  const handleCancelProfileEdit = () => {
    if (user) {
      setProfileEditForm({
        bio: user.bio || "",
        displayName: user.displayName || "",
        city: user.city || "",
        institutions: Array.isArray(user.institutions) ? user.institutions : [],
        websites: Array.isArray(user.websites) ? user.websites : []
      })
      setSelectedLocation(user.location)
    }
    setIsEditingProfile(false)
    setPendingInstitution("")
    setPendingWebsite("")
    setInstitutionError("")
    setWebsiteError("")
  }

  const handleCancelAccountEdit = () => {
    if (user) {
      setAccountEditForm({
        username: user.username,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      })
    }
    setIsEditingAccount(false)
    setUsernameError("")
    setPasswordError("")
    setIsUsernameEditable(false)
    setIsPasswordSectionOpen(false)
  }

  const handleCancelUsernameEdit = () => {
    setIsUsernameEditable(false)
    // Reset username to original value
    if (user) {
      setAccountEditForm(prev => ({
        ...prev,
        username: user.username
      }))
    }
    setUsernameError("")
  }

  const handleCancelPasswordEdit = () => {
    setIsPasswordSectionOpen(false)
    // Clear all password fields
    setAccountEditForm(prev => ({
      ...prev,
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }))
    setPasswordError("")
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
      
      // Emit global state synchronization event for profile image update
      stateSyncUtils.updateUserProfile(user.id.toString(), {
        image: photoUrl || undefined
      })
    }
    setShowPhotoUpload(false)
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

  // Helper functions for managing institutions and websites
  const addInstitution = () => {
    const trimmed = pendingInstitution.trim()
    if (!trimmed) {
      setInstitutionError("Institution name cannot be empty")
      return
    }
    
    const institutions = Array.isArray(profileEditForm.institutions) ? profileEditForm.institutions : []
    if (institutions.length >= 10) {
      setInstitutionError("Maximum 10 institutions allowed")
      return
    }

    if (institutions.includes(trimmed)) {
      setInstitutionError("Institution already added")
      return
    }

    setProfileEditForm({
      ...profileEditForm,
      institutions: [...institutions, trimmed]
    })
    setPendingInstitution("")
    setInstitutionError("")
  }

  const removeInstitution = (index: number) => {
    const institutions = Array.isArray(profileEditForm.institutions) ? profileEditForm.institutions : []
    const newInstitutions = institutions.filter((_, i) => i !== index)
    setProfileEditForm({
      ...profileEditForm,
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
    
    const websites = Array.isArray(profileEditForm.websites) ? profileEditForm.websites : []
    if (websites.length >= 5) {
      setWebsiteError("Maximum 5 websites allowed")
      return
    }

    if (websites.includes(normalizedUrl)) {
      setWebsiteError("Website already added")
      return
    }

    setProfileEditForm({
      ...profileEditForm,
      websites: [...websites, normalizedUrl]
    })
    setPendingWebsite("")
    setWebsiteError("")
  }

  const removeWebsite = (index: number) => {
    const websites = Array.isArray(profileEditForm.websites) ? profileEditForm.websites : []
    const newWebsites = websites.filter((_, i) => i !== index)
    setProfileEditForm({
      ...profileEditForm,
      websites: newWebsites
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar user={currentUser} onLogout={handleLogout} />

      {/* Profile Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="max-w-2xl mx-auto">
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
                  {isEditingAccount ? (
                    <div className="space-y-4 max-w-2xl">
                      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Account Settings</h2>
                      
                      {/* Email Display */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                      </div>

                      {/* Username Section */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            ref={usernameInputRef}
                            value={accountEditForm.username}
                            readOnly={!isUsernameEditable}
                            onChange={(e) => setAccountEditForm({ ...accountEditForm, username: e.target.value })}
                            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                              isUsernameEditable
                                ? 'border-gray-300'
                                : 'border-gray-200 bg-gray-100 cursor-not-allowed'
                            }`}
                            maxLength={50}
                            autoComplete="username"
                            name="username"
                          />
                          <button
                            onClick={() => isUsernameEditable ? handleCancelUsernameEdit() : setIsUsernameEditable(true)}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            {isUsernameEditable ? 'Cancel' : 'Change'}
                          </button>
                        </div>
                        {usernameError && <p className="text-xs text-red-600 mt-1">{usernameError}</p>}
                      </div>

                      {/* Password Section */}
                      <div ref={passwordSectionRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="password"
                            value="********"
                            readOnly
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed"
                          />
                          <button
                            onClick={() => {
                              if (user?.oauth_provider) return
                              if (isPasswordSectionOpen) {
                                handleCancelPasswordEdit()
                              } else {
                                setIsPasswordSectionOpen(true)
                              }
                            }}
                            disabled={user?.oauth_provider ? true : false}
                            title={user?.oauth_provider ? `Password management is not available for accounts created with ${user.oauth_provider} login` : undefined}
                            className={`px-4 py-2 text-sm border border-gray-300 rounded-lg relative ${
                              user?.oauth_provider 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed group' 
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {isPasswordSectionOpen ? 'Cancel' : 'Change'}
                            {user?.oauth_provider && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 hidden sm:block">
                                Password management is not available for {user.oauth_provider} accounts
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                              </div>
                            )}
                          </button>
                        </div>
                        {isPasswordSectionOpen && !user?.oauth_provider && (
                          <div className="space-y-2 mt-2 pl-2 border-l-2 border-gray-200">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                              <div className="relative">
                                <input
                                  type={showCurrentPassword ? "text" : "password"}
                                  value={accountEditForm.currentPassword}
                                  onChange={(e) => setAccountEditForm({ ...accountEditForm, currentPassword: e.target.value })}
                                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  autoComplete="current-password"
                                  name="currentPassword"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                  {showCurrentPassword ? (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                              <div className="relative">
                                <input
                                  type={showNewPassword ? "text" : "password"}
                                  value={accountEditForm.newPassword}
                                  onChange={(e) => setAccountEditForm({ ...accountEditForm, newPassword: e.target.value })}
                                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  autoComplete="off"
                                  name="newPassword"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                  {showNewPassword ? (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                              <div className="relative">
                                <input
                                  type={showConfirmPassword ? "text" : "password"}
                                  value={accountEditForm.confirmPassword}
                                  onChange={(e) => setAccountEditForm({ ...accountEditForm, confirmPassword: e.target.value })}
                                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  autoComplete="off"
                                  name="confirmPassword"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                  {showConfirmPassword ? (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {passwordError && <p className="text-xs text-red-600 mt-1">{passwordError}</p>}
                      </div>

                      {/* Save/Cancel Buttons */}
                      <div className="mt-6 flex space-x-2 justify-end">
                        <button
                          onClick={handleCancelAccountEdit}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveAccount}
                          disabled={!isUsernameEditable && !isPasswordSectionOpen}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                            isUsernameEditable || isPasswordSectionOpen
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : isEditingProfile ? (
                    <div className="space-y-4 max-w-2xl">
                      <h2 className="text-xl font-bold text-gray-900 border-b pb-2">Profile Information</h2>
                      
                      {/* Display Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={profileEditForm.displayName}
                          onChange={(e) => setProfileEditForm({ ...profileEditForm, displayName: e.target.value })}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getCompleteInputStyling().className}`}
                          style={getCompleteInputStyling().style}
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
                          value={user?.username || ''}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                        {usernameError && <p className="text-xs text-red-600 mt-1">{usernameError}</p>}
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Bio
                        </label>
                        <textarea
                          value={profileEditForm.bio}
                          onChange={(e) => setProfileEditForm({ ...profileEditForm, bio: e.target.value })}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getCompleteInputStyling().className}`}
                          style={getCompleteInputStyling().style}
                          rows={3}
                          maxLength={500}
                          placeholder="Tell us about yourself..."
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {profileEditForm.bio.length}/500 characters
                        </p>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <LocationAutocomplete
                          value={profileEditForm.city}
                          onChange={(value) => setProfileEditForm({ ...profileEditForm, city: value })}
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
                          {Array.isArray(profileEditForm.institutions) && profileEditForm.institutions.map((institution, index) => (
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
                          {Array.isArray(profileEditForm.institutions) && profileEditForm.institutions.length < 10 && (
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
                                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getCompleteInputStyling().className}`}
                                  style={getCompleteInputStyling().style}
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
                          {Array.isArray(profileEditForm.websites) && profileEditForm.websites.map((website, index) => (
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
                          {Array.isArray(profileEditForm.websites) && profileEditForm.websites.length < 5 && (
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
                                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getCompleteInputStyling().className}`}
                                  style={getCompleteInputStyling().style}
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

                      {/* Edit Profile and Account Buttons - positioned below "Joined..." text */}
                      {!isEditingProfile && !isEditingAccount && (
                        <div className="mt-4 flex justify-center sm:justify-start space-x-2">
                          <button
                            onClick={handleEditProfile}
                            className="flex items-center space-x-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm min-h-[44px] touch-manipulation"
                          >
                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Edit Profile</span>
                          </button>
                          <button
                            onClick={handleEditAccount}
                            className="flex items-center space-x-2 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm min-h-[44px] touch-manipulation"
                          >
                            <Shield className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>Edit Account</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Cancel/Save Buttons - positioned below profile details when editing */}
                  {isEditingProfile && (
                    <div className="mt-6 flex space-x-2 justify-center sm:justify-start">
                      <button
                        onClick={handleCancelProfileEdit}
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
              <button 
                className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                onClick={handlePostsClick}
                aria-label={`View your ${user.postsCount} posts`}
                title="Click to view your posts"
              >
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.postsCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Posts</div>
              </button>
              <button 
                className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                onClick={() => setShowFollowersModal(true)}
                aria-label={`View your ${user.followersCount} followers`}
              >
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.followersCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Followers</div>
              </button>
              <button 
                className="text-center hover:bg-gray-50 rounded-lg p-2 transition-colors min-h-[44px] touch-manipulation"
                onClick={() => setShowFollowingModal(true)}
                aria-label={`View ${user.followingCount} users you're following`}
              >
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user.followingCount}</div>
                <div className="text-xs sm:text-sm text-gray-500">Following</div>
              </button>
            </div>
          </div>

          {/* Posts Section */}
          <div 
            id="posts-section" 
            className={`space-y-6 transition-all duration-500 ${
              postsHighlighted 
                ? 'bg-purple-50 border-2 border-purple-200 rounded-xl p-4 -m-4' 
                : ''
            }`}
          >
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

      {/* Modals */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={user.id}
        username={user.displayName || user.username}
      />
      
      <FollowingModal
        isOpen={showFollowingModal}
        onClose={() => setShowFollowingModal(false)}
        userId={user.id}
        username={user.displayName || user.username}
      />
      
      {/* Hidden form to trigger browser password manager */}
      <form 
        id="password-manager-form" 
        style={{ display: 'none' }} 
        action="#" 
        method="post"
        onSubmit={(e) => e.preventDefault()}
      >
        <input 
          type="text" 
          name="username" 
          autoComplete="username"
        />
        <input 
          type="password" 
          name="password" 
          autoComplete="new-password"
        />
      </form>
    </div>
  )
}
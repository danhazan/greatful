/**
 * User-related TypeScript types for the Grateful application.
 */

export interface User {
    id: string
    username: string
    email?: string
    name: string
    displayName?: string
    profileImageUrl?: string
    image?: string // Legacy support
    isPublic?: boolean
}

export interface UserProfile extends User {
    bio?: string
    createdAt?: string
    postsCount: number
    followerCount: number
    followingCount: number
    isFollowing: boolean | null
}

export interface UserPreferences {
    userId: string
    allowSharing: boolean
    allowMentions: boolean
    privacyLevel: 'public' | 'followers' | 'private'
    notificationSettings: {
        shareNotifications: boolean
        mentionNotifications: boolean
        reactionNotifications: boolean
        followNotifications: boolean
    }
}

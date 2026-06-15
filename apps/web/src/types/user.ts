/**
 * User-related TypeScript types for the Grateful application.
 */

export interface User {
    id: string
    username: string | null
    email?: string
    name: string
    displayName?: string | null
    profileImageUrl?: string | null
    image?: string | null // Legacy support
    isPublic?: boolean
    isDeleted?: boolean
    accountStatus?: string
}

export interface UserProfile extends User {
    bio?: string | null
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
    regionalDateFormat?: string | null
}

/**
 * Post-related TypeScript types for the Grateful application.
 */

export interface PostImage {
    id: string
    position: number
    thumbnailUrl: string
    mediumUrl: string
    originalUrl: string
    width?: number
    height?: number
}

export interface PostStyle {
    id: string
    name: string
    backgroundColor: string
    backgroundGradient?: string
    textColor: string
    borderStyle?: string
    fontFamily?: string
    textShadow?: string
}

export interface Author {
    id: string
    username: string
    name: string
    displayName?: string
    profileImageUrl?: string
    image?: string // Legacy support
    followerCount: number
    followingCount: number
    postsCount: number
    isFollowing: boolean | null
    bio?: string
}

export interface LocationData {
    displayName: string
    lat: number
    lon: number
    placeId?: string
    address: {
        city?: string
        state?: string
        country?: string
        countryCode?: string
    }
    importance?: number
    type?: string
}

export interface Post {
    id: string
    content: string
    richContent?: string
    postStyle?: PostStyle
    author: Author
    createdAt: string
    updatedAt?: string
    postType: 'daily' | 'photo' | 'spontaneous'
    imageUrl?: string // Legacy single image URL
    images?: PostImage[]
    location?: string
    locationData?: LocationData
    heartsCount: number
    isHearted: boolean
    reactionsCount: number
    currentUserReaction?: string
    isRead?: boolean
    isUnread?: boolean
    commentsCount?: number
    algorithmScore?: number
}

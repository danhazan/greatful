/**
 * Data transformation utilities for API responses
 */

import { stripHtmlTags } from '@/utils/htmlUtils'

// Notification transformation types
export interface BackendNotification {
  id: string
  user_id: number
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  updated_at: string
  metadata?: any
  actor_user?: {
    id: number
    username: string
    display_name: string
    profile_image_url?: string
  }
  is_batch?: boolean
  batch_count?: number
}

export interface FrontendNotification {
  id: string
  userId: number
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  updatedAt: string
  metadata?: any
  actorUser?: {
    id: number
    username: string
    displayName: string
    profileImageUrl?: string
  }
  isBatch?: boolean
  batchCount?: number
}

/**
 * Transform backend notification to frontend format
 */
export function transformNotification(notification: BackendNotification): FrontendNotification {
  return {
    id: notification.id,
    userId: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: stripHtmlTags(notification.message || ""),
    isRead: notification.is_read,
    createdAt: ensureTimezoneIndicator(notification.created_at),
    updatedAt: ensureTimezoneIndicator(notification.updated_at),
    metadata: notification.metadata,
    actorUser: notification.actor_user ? {
      id: notification.actor_user.id,
      username: notification.actor_user.username,
      displayName: notification.actor_user.display_name,
      profileImageUrl: notification.actor_user.profile_image_url,
    } : undefined,
    isBatch: notification.is_batch,
    batchCount: notification.batch_count,
  }
}

/**
 * Transform array of backend notifications to frontend format
 */
export function transformNotifications(notifications: BackendNotification[]): FrontendNotification[] {
  return notifications.map(transformNotification)
}

/**
 * Ensure timestamp has timezone indicator (Z suffix for UTC)
 */
export function ensureTimezoneIndicator(timestamp: string): string {
  if (!timestamp) return timestamp
  
  // If timestamp already has timezone info, return as is
  if (timestamp.includes('Z') || timestamp.includes('+') || timestamp.includes('-')) {
    return timestamp
  }
  
  // Add Z suffix to indicate UTC
  return `${timestamp}Z`
}

// Post transformation types
export interface BackendPost {
  id: string
  user_id: number
  content: string
  rich_content?: string
  post_style?: any
  image_url?: string
  created_at: string
  updated_at: string
  user?: {
    id: number
    username: string
    display_name: string
    profile_image_url?: string
  }
}

export interface FrontendPost {
  id: string
  userId: number
  content: string
  postStyle?: any
  post_style?: any  // Backend field name
  imageUrl?: string
  createdAt: string
  updatedAt: string
  user?: {
    id: number
    username: string
    displayName: string
    profileImageUrl?: string
  }
}

/**
 * Transform backend post to frontend format
 */
export function transformPost(post: BackendPost): FrontendPost {
  return {
    id: post.id,
    userId: post.user_id,
    content: post.content,
    postStyle: post.post_style,
    post_style: post.post_style,  // Keep backend field name for compatibility
    imageUrl: post.image_url,
    createdAt: ensureTimezoneIndicator(post.created_at),
    updatedAt: ensureTimezoneIndicator(post.updated_at),
    user: post.user ? {
      id: post.user.id,
      username: post.user.username,
      displayName: post.user.display_name,
      profileImageUrl: post.user.profile_image_url,
    } : undefined,
  }
}

/**
 * Transform array of backend posts to frontend format
 */
export function transformPosts(posts: BackendPost[]): FrontendPost[] {
  return posts.map(transformPost)
}

// User transformation types
export interface BackendUser {
  id: number
  username: string
  display_name: string
  profile_image_url?: string
  created_at: string
  updated_at: string
}

export interface FrontendUser {
  id: number
  username: string
  displayName: string
  profileImageUrl?: string
  createdAt: string
  updatedAt: string
}

/**
 * Transform backend user to frontend format
 */
export function transformUser(user: BackendUser): FrontendUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    profileImageUrl: user.profile_image_url,
    createdAt: ensureTimezoneIndicator(user.created_at),
    updatedAt: ensureTimezoneIndicator(user.updated_at),
  }
}

/**
 * Transform array of backend users to frontend format
 */
export function transformUsers(users: BackendUser[]): FrontendUser[] {
  return users.map(transformUser)
}

// Reaction transformation types
export interface BackendReaction {
  id: string
  user_id: number
  emoji_code: string
  created_at: string
  user?: {
    id: number
    username: string
    profile_image_url?: string
  }
}

export interface FrontendReaction {
  id: string
  userId: string
  userName: string
  userImage?: string
  emojiCode: string
  createdAt: string
}

/**
 * Transform backend reaction to frontend format
 */
export function transformReaction(reaction: BackendReaction): FrontendReaction {
  return {
    id: reaction.id || '',
    userId: reaction.user_id?.toString() || '0',
    userName: reaction.user?.username || 'Unknown User',
    userImage: reaction.user?.profile_image_url,
    emojiCode: reaction.emoji_code || '',
    createdAt: ensureTimezoneIndicator(reaction.created_at || ''),
  }
}

/**
 * Transform array of backend reactions to frontend format
 */
export function transformReactions(reactions: BackendReaction[]): FrontendReaction[] {
  if (!Array.isArray(reactions)) {
    console.error('transformReactions: reactions is not an array:', reactions)
    return []
  }
  return reactions.map(transformReaction)
}

// Extended post transformation for user posts with author info
// Image type for multi-image posts
export interface BackendPostImage {
  id: string
  position: number
  thumbnail_url?: string
  thumbnailUrl?: string  // camelCase variant
  medium_url?: string
  mediumUrl?: string
  original_url?: string
  originalUrl?: string
  width?: number
  height?: number
}

export interface FrontendPostImage {
  id: string
  position: number
  thumbnailUrl: string
  mediumUrl: string
  originalUrl: string
  width?: number
  height?: number
}

export interface BackendUserPost {
  id: string
  content: string
  rich_content?: string
  post_style?: {
    id: string
    name: string
    backgroundColor: string
    backgroundGradient?: string
    textColor: string
    borderStyle?: string
    fontFamily?: string
    textShadow?: string
  }
  created_at: string
  updated_at?: string
  post_type?: string
  image_url?: string
  images?: BackendPostImage[]  // Multi-image support
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
  author: {
    id: string
    username: string
    display_name?: string
    email: string
    profile_image_url?: string
  }
  hearts_count?: number
  is_hearted?: boolean
  reactions_count?: number
  current_user_reaction?: string
}

export interface FrontendUserPost {
  id: string
  content: string
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
  post_style?: {  // Backend field name
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
    username: string
    display_name?: string
    image?: string
  }
  createdAt: string
  updatedAt?: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  images?: FrontendPostImage[]  // Multi-image support
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
  commentsCount: number
  currentUserReaction?: string
}

/**
 * Normalize a single image from backend format to frontend format
 * Handles both snake_case and camelCase field names
 */
function normalizePostImage(img: BackendPostImage): FrontendPostImage {
  return {
    id: img.id,
    position: img.position,
    thumbnailUrl: img.thumbnailUrl ?? img.thumbnail_url ?? '',
    mediumUrl: img.mediumUrl ?? img.medium_url ?? '',
    originalUrl: img.originalUrl ?? img.original_url ?? '',
    width: img.width,
    height: img.height
  }
}

/**
 * Transform backend user post to frontend format with author info
 * Handles both snake_case (direct backend) and camelCase (Next.js API proxy) formats
 */
export function transformUserPost(post: any, userProfile?: any): FrontendUserPost {
  // Handle both snake_case and camelCase field names
  const postStyle = post.postStyle || post.post_style
  const createdAt = post.createdAt || post.created_at
  const updatedAt = post.updatedAt || post.updated_at
  const postType = post.postType || post.post_type
  const imageUrl = post.imageUrl || post.image_url
  const locationData = post.location_data
  const heartsCount = post.heartsCount ?? post.hearts_count ?? 0
  const isHearted = post.isHearted ?? post.is_hearted ?? false
  const reactionsCount = post.reactionsCount ?? post.reactions_count ?? 0
  const commentsCount = post.commentsCount ?? post.comments_count ?? 0
  const currentUserReaction = post.currentUserReaction || post.current_user_reaction

  // Normalize images array for multi-image support
  const images: FrontendPostImage[] | undefined = post.images && Array.isArray(post.images)
    ? post.images.map(normalizePostImage).sort((a: FrontendPostImage, b: FrontendPostImage) => a.position - b.position)
    : undefined

  return {
    id: post.id,
    content: post.content,
    postStyle: postStyle,
    post_style: postStyle,  // Keep backend field name for compatibility
    author: {
      id: post.author.id.toString(),
      name: post.author.display_name || post.author.name || post.author.username || 'Unknown User',
      username: post.author.username || 'unknown',
      display_name: post.author.display_name || post.author.username,
      image: post.author.image || post.author.profile_image_url
    },
    createdAt: ensureTimezoneIndicator(createdAt),
    updatedAt: updatedAt ? ensureTimezoneIndicator(updatedAt) : undefined,
    postType: (postType as "daily" | "photo" | "spontaneous") || "daily",
    imageUrl: imageUrl,
    images: images,  // Include normalized images array
    location: post.location,
    location_data: locationData,
    heartsCount: heartsCount,
    isHearted: isHearted,
    reactionsCount: reactionsCount,
    commentsCount: commentsCount,
    currentUserReaction: currentUserReaction
  }
}

/**
 * Transform array of backend user posts to frontend format
 */
export function transformUserPosts(posts: BackendUserPost[], userProfile?: any): FrontendUserPost[] {
  return posts.map(post => transformUserPost(post, userProfile))
}
/**
 * Data transformation utilities for API responses
 */

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
    message: notification.message,
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
  post_type?: string
  image_url?: string
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

/**
 * Transform backend user post to frontend format with author info
 */
export function transformUserPost(post: BackendUserPost, userProfile?: any): FrontendUserPost {
  return {
    id: post.id,
    content: post.content,
    postStyle: post.post_style,
    post_style: post.post_style,  // Keep backend field name for compatibility
    author: {
      id: post.author.id.toString(),
      name: post.author.username || 'Unknown User',
      username: post.author.username || 'unknown',
      display_name: post.author.username,
      image: post.author.profile_image_url
    },
    createdAt: ensureTimezoneIndicator(post.created_at),
    postType: (post.post_type as "daily" | "photo" | "spontaneous") || "daily",
    imageUrl: post.image_url,
    location: post.location,
    location_data: post.location_data,
    heartsCount: post.hearts_count || 0,
    isHearted: post.is_hearted || false,
    reactionsCount: post.reactions_count || 0,
    currentUserReaction: post.current_user_reaction
  }
}

/**
 * Transform array of backend user posts to frontend format
 */
export function transformUserPosts(posts: BackendUserPost[], userProfile?: any): FrontendUserPost[] {
  return posts.map(post => transformUserPost(post, userProfile))
}
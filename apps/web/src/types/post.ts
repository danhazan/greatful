/**
 * Post-related TypeScript types for the Grateful application.
 *
 * These types define the shape of post data received from the API
 * and used throughout the frontend.
 */

/**
 * Represents a single image attached to a post.
 *
 * Multi-image posts can have up to MAX_POST_IMAGES images.
 * Each image has three variants for different display contexts.
 */
export interface PostImage {
  id: string
  position: number
  /** URL for thumbnail variant - used in upload previews and reorder UI */
  thumbnailUrl: string
  /** URL for medium variant - used in feed display and fullscreen viewer */
  mediumUrl: string
  /** URL for original variant - preserved, capped to prevent large files */
  originalUrl: string
  /** Original image width in pixels */
  width?: number
  /** Original image height in pixels */
  height?: number
}

/**
 * Post style configuration for styled posts.
 */
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

/**
 * Location data for geo-tagged posts.
 */
export interface LocationData {
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

/**
 * Post author information.
 */
export interface PostAuthor {
  id: string
  name: string
  username?: string
  display_name?: string
  image?: string
  profile_image_url?: string
}

/**
 * Main Post interface representing a gratitude post.
 *
 * Supports both single-image (legacy imageUrl field) and multi-image (images array).
 */
export interface Post {
  id: string
  content: string
  richContent?: string
  postStyle?: PostStyle
  post_style?: PostStyle  // Backend field name variant
  author: PostAuthor
  createdAt: string
  updatedAt?: string
  postType: 'daily' | 'photo' | 'spontaneous'
  /** Legacy single image URL - deprecated, use images array */
  imageUrl?: string
  /** Multi-image support: array of image objects with variants */
  images?: PostImage[]
  location?: string
  location_data?: LocationData
  heartsCount: number
  isHearted: boolean
  reactionsCount: number
  currentUserReaction?: string
  isRead?: boolean
  isUnread?: boolean
  commentsCount?: number
  algorithmScore?: number
}

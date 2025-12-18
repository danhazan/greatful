/**
 * Utility to normalize API post responses to frontend Post interface
 * Note: API responses are now automatically transformed to camelCase by the API layer
 * This utility primarily handles response wrappers and provides type safety
 */

/** API image data from backend */
export interface ApiPostImage {
  id: string
  position: number
  thumbnailUrl?: string
  thumbnail_url?: string  // Snake case from API
  mediumUrl?: string
  medium_url?: string
  originalUrl?: string
  original_url?: string
  width?: number
  height?: number
}

/** Normalized image data for frontend */
export interface NormalizedPostImage {
  id: string
  position: number
  thumbnailUrl: string
  mediumUrl: string
  originalUrl: string
  width?: number
  height?: number
}

export interface ApiPost {
  id: string
  authorId?: number
  content: string
  postStyle?: any
  postType?: string
  imageUrl?: string
  images?: ApiPostImage[]  // Multi-image support
  location?: string
  locationData?: any
  createdAt?: string
  updatedAt?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  commentsCount?: number
  currentUserReaction?: string
  isRead?: boolean
  isUnread?: boolean
  author?: {
    id: string | number
    userId?: string | number
    name?: string
    username?: string
    displayName?: string
    image?: string
    profileImageUrl?: string
  }
}

export interface NormalizedPost {
  id: string
  content: string
  postStyle?: any
  createdAt: string
  updatedAt?: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string  // Legacy single image, deprecated
  images?: NormalizedPostImage[]  // Multi-image support
  location?: string
  location_data?: any
  heartsCount: number
  isHearted: boolean
  reactionsCount: number
  commentsCount: number
  currentUserReaction?: string
  isRead?: boolean
  isUnread?: boolean
  author: {
    id: string
    name: string
    username?: string
    display_name?: string
    image?: string
  }
}

/**
 * Normalizes API post response to frontend Post interface
 * Handles both direct post objects and wrapped responses ({ data: ... })
 * Note: API responses are now automatically transformed to camelCase
 */
export function normalizePostFromApi(apiResponse: any): NormalizedPost | null {
  if (!apiResponse) return null

  // Handle wrapped responses (e.g., { data: post })
  const post: ApiPost = apiResponse.data ?? apiResponse

  if (!post || !post.id) return null

  const author = post.author ?? {} as any

  // Normalize images array
  const normalizedImages: NormalizedPostImage[] = post.images
    ? post.images.map(img => ({
        id: img.id,
        position: img.position,
        thumbnailUrl: img.thumbnailUrl ?? img.thumbnail_url ?? '',
        mediumUrl: img.mediumUrl ?? img.medium_url ?? '',
        originalUrl: img.originalUrl ?? img.original_url ?? '',
        width: img.width,
        height: img.height
      })).sort((a, b) => a.position - b.position)
    : []

  return {
    id: String(post.id),
    content: post.content ?? "",
    postStyle: post.postStyle ?? undefined,

    // All fields are now in camelCase from API
    createdAt: post.createdAt ?? new Date().toISOString(),
    updatedAt: post.updatedAt ?? undefined,

    postType: (post.postType ?? "spontaneous") as "daily" | "photo" | "spontaneous",
    imageUrl: post.imageUrl ?? undefined,  // Legacy single image
    images: normalizedImages.length > 0 ? normalizedImages : undefined,  // Multi-image
    location: post.location ?? undefined,
    location_data: post.locationData ?? undefined,

    heartsCount: post.heartsCount ?? 0,
    isHearted: post.isHearted ?? false,
    reactionsCount: post.reactionsCount ?? 0,
    commentsCount: post.commentsCount ?? 0,
    currentUserReaction: post.currentUserReaction ?? undefined,
    isRead: post.isRead ?? false,
    isUnread: post.isUnread ?? false,

    author: {
      id: String(author.id ?? author.userId ?? ""),
      name: author.name ?? author.displayName ?? author.username ?? "",
      username: author.username ?? undefined,
      display_name: author.displayName ?? undefined,
      image: author.image ?? author.profileImageUrl ?? undefined
    }
  }
}

/**
 * Safely merges normalized post data with existing post state
 * Preserves author fields that might not be included in API responses
 */
export function mergePostUpdate(existingPost: any, normalizedUpdate: NormalizedPost): any {
  return {
    ...existingPost,
    ...normalizedUpdate,
    author: {
      ...existingPost?.author,
      ...normalizedUpdate.author,
      // Preserve existing image if new response doesn't include it
      image: normalizedUpdate.author.image ?? existingPost?.author?.image
    }
  }
}

/**
 * Debug helper to log API response structure
 */
export function debugApiResponse(response: any, context: string = "API Response") {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`${context}:`, {
      hasData: !!response.data,
      keys: Object.keys(response),
      dateFields: {
        createdAt: response.createdAt ?? response.data?.createdAt,
        updatedAt: response.updatedAt ?? response.data?.updatedAt
      }
    })
  }
}
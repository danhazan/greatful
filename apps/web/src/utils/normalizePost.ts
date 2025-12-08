/**
 * Utility to normalize API post responses to frontend Post interface
 * Note: API responses are now automatically transformed to camelCase by the API layer
 * This utility primarily handles response wrappers and provides type safety
 */

export interface ApiPost {
  id: string
  authorId?: number
  content: string
  postStyle?: any
  postType?: string
  imageUrl?: string
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
  imageUrl?: string
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

  return {
    id: String(post.id),
    content: post.content ?? "",
    postStyle: post.postStyle ?? undefined,
    
    // All fields are now in camelCase from API
    createdAt: post.createdAt ?? new Date().toISOString(),
    updatedAt: post.updatedAt ?? undefined,
    
    postType: (post.postType ?? "spontaneous") as "daily" | "photo" | "spontaneous",
    imageUrl: post.imageUrl ?? undefined,
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
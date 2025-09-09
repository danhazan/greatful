/**
 * Utility to normalize API post responses to frontend Post interface
 * Handles snake_case to camelCase conversion and response wrappers
 */

export interface ApiPost {
  id: string
  author_id?: number
  content: string
  post_style?: any
  postStyle?: any
  post_type?: string
  postType?: string
  image_url?: string
  imageUrl?: string
  location?: string
  location_data?: any
  locationData?: any
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
  hearts_count?: number
  heartsCount?: number
  is_hearted?: boolean
  isHearted?: boolean
  reactions_count?: number
  reactionsCount?: number
  current_user_reaction?: string
  currentUserReaction?: string
  author?: {
    id: string | number
    user_id?: string | number
    name?: string
    username?: string
    display_name?: string
    image?: string
    profile_image_url?: string
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
  currentUserReaction?: string
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
    postStyle: post.post_style ?? post.postStyle ?? undefined,
    
    // Map backend snake_case to frontend camelCase
    createdAt: post.created_at ?? post.createdAt ?? new Date().toISOString(),
    updatedAt: post.updated_at ?? post.updatedAt ?? undefined,
    
    postType: (post.post_type ?? post.postType ?? "spontaneous") as "daily" | "photo" | "spontaneous",
    imageUrl: post.image_url ?? post.imageUrl ?? undefined,
    location: post.location ?? undefined,
    location_data: post.location_data ?? post.locationData ?? undefined,
    
    heartsCount: post.hearts_count ?? post.heartsCount ?? 0,
    isHearted: post.is_hearted ?? post.isHearted ?? false,
    reactionsCount: post.reactions_count ?? post.reactionsCount ?? 0,
    currentUserReaction: post.current_user_reaction ?? post.currentUserReaction ?? undefined,
    
    author: {
      id: String(author.id ?? author.user_id ?? ""),
      name: author.name ?? author.display_name ?? author.username ?? "",
      username: author.username ?? undefined,
      display_name: author.display_name ?? undefined,
      // Handle multiple possible profile image field names
      image: author.profile_image_url ?? author.image ?? undefined
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
        created_at: response.created_at ?? response.data?.created_at,
        updated_at: response.updated_at ?? response.data?.updated_at,
        createdAt: response.createdAt ?? response.data?.createdAt,
        updatedAt: response.updatedAt ?? response.data?.updatedAt
      }
    })
  }
}
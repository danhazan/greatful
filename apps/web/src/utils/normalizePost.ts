import { Post, Author, PostImage, PostPrivacy } from '@/types/post'
import { assertNoSnakeCase } from './contractAssertion'

/**
 * Utility to normalize API post responses to frontend Post interface.
 * Primarily serves as a Guard Layer ensuring strict camelCase contract compliance.
 */

/**
 * Normalizes API post response to frontend Post interface.
 * Handles both direct post objects and wrapped responses ({ data: ... }).
 * 
 * In the new unified contract, the API returns camelCase directly.
 * This function asserts that correctness and casts to the canonical Post type.
 */
function extractPostPrivacyFromApi(post: any): PostPrivacy {
  const level = post?.privacyLevel
  return {
    privacyLevel: (level === 'public' || level === 'private' || level === 'custom') ? level : undefined,
    privacyRules: post?.privacyRules ?? [],
    specificUsers: post?.specificUsers ?? [],
  }
}

export function normalizePostFromApi(apiResponse: any): Post | null {
  if (!apiResponse) return null

  // Handle wrapped responses (e.g., { data: post })
  const rawPost = apiResponse.data ?? apiResponse

  if (!rawPost || !rawPost.id) return null

  // Runtime validation in development to detect contract regressions
  assertNoSnakeCase(rawPost, 'PostResponse')

  // Preserve canonical privacy fields even if upstream casing drifts.
  const privacy = extractPostPrivacyFromApi(rawPost)

  // We still do minimal transformation for legacy or edge cases if necessary, 
  // but the goal is direct casting.
  return {
    ...rawPost,
    createdAt: rawPost.createdAt || new Date().toISOString(),
    updatedAt: rawPost.updatedAt || undefined,
    ...privacy,
  } as Post
}

/**
 * Safely merges normalized post data with existing post state.
 */
export function mergePostUpdate(existingPost: Post, normalizedUpdate: Post): Post {
  return {
    ...existingPost,
    ...normalizedUpdate,
    author: {
      ...existingPost.author,
      ...normalizedUpdate.author
    }
  }
}

/**
 * Debug helper to log API response structure.
 */
export function debugApiResponse(response: any, context: string = "API Response") {
  if (process.env['NODE_ENV'] === 'development') {
    console.debug(`${context}:`, {
      hasData: !!response.data,
      keys: Object.keys(response.data ?? response),
      sampleData: response.data ?? response
    })
  }
}

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
  return {
    privacyLevel: post?.privacyLevel ?? post?.privacy_level,
    privacyRules: post?.privacyRules ?? post?.privacy_rules ?? post?.rules ?? [],
    specificUsers: post?.specificUsers ?? post?.specific_users ?? [],
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

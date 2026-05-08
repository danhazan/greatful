import { Post, Author, PostImage, PostPrivacy } from '@/types/post'
import { assertNoSnakeCase } from './contractAssertion'

/**
 * Utility to normalize API post responses to frontend Post interface.
 * Primarily serves as a Guard Layer ensuring strict camelCase contract compliance.
 */

function getApiBaseUrl(): string {
  // Authoritative: Environment variable (set in CI/prod)
  const envUrl = process.env['NEXT_PUBLIC_API_URL'] || process.env['API_BASE_URL']
  if (envUrl) return envUrl.replace(/\/$/, '')

  // Fallback for browser-only scenarios without ENV (rare)
  if (typeof window !== 'undefined') {
    return (window.location.origin).replace(/\/$/, '')
  }

  // Final deterministic fallback for local dev/tests
  return 'http://localhost:8000'
}

function toAbsoluteUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  const baseUrl = getApiBaseUrl()
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`
}

function extractPostPrivacyFromApi(post: any): PostPrivacy {
  const level = post?.privacyLevel
  return {
    privacyLevel: (level === 'public' || level === 'private' || level === 'custom') ? level : undefined,
    privacyRules: post?.privacyRules ?? [],
    specificUsers: post?.specificUsers ?? [],
  }
}

/**
 * Canonical post normalizer. ALL post data in the app must pass through this function.
 *
 * INVARIANTS:
 * - This function NEVER mutates its input. It produces a fresh, immutable copy.
 * - The returned Post object is the sole authoritative shape for rendering.
 * - SSR payloads are bootstrap-only; authenticated CSR fetches fully replace them.
 */
export function normalizePostFromApi(apiResponse: any): Post | null {
  if (!apiResponse) return null

  // Handle wrapped responses (e.g., { data: post })
  const rawPost = apiResponse.data ?? apiResponse

  if (!rawPost || !rawPost.id) return null

  // Runtime validation in development to detect contract regressions
  assertNoSnakeCase(rawPost, 'PostResponse')

  // Preserve canonical privacy fields even if upstream casing drifts.
  const privacy = extractPostPrivacyFromApi(rawPost)

  // Build normalized author (immutable — never mutate rawPost)
  let normalizedAuthor = rawPost.author
  if (rawPost.author) {
    const authorImage = rawPost.author.image || rawPost.author.profileImageUrl
    const normalizedAuthorImage = authorImage ? toAbsoluteUrl(authorImage) : undefined
    normalizedAuthor = {
      ...rawPost.author,
      id: String(rawPost.author.id),
      ...(normalizedAuthorImage ? {
        profileImageUrl: normalizedAuthorImage,
        image: normalizedAuthorImage,
      } : {}),
    }
  }

  // Build normalized images array (immutable — never mutate rawPost.images)
  const normalizedImages = Array.isArray(rawPost.images)
    ? rawPost.images.map((img: any) => ({
        ...img,
        thumbnailUrl: toAbsoluteUrl(img.thumbnailUrl) || '',
        mediumUrl: toAbsoluteUrl(img.mediumUrl) || '',
        originalUrl: toAbsoluteUrl(img.originalUrl) || '',
      }))
    : rawPost.images

  return {
    ...rawPost,
    author: normalizedAuthor,
    imageUrl: rawPost.imageUrl ? toAbsoluteUrl(rawPost.imageUrl) : rawPost.imageUrl,
    images: normalizedImages,
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

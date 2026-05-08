import { transformApiResponse } from '@/lib/caseTransform'
import { normalizePostFromApi } from '@/utils/normalizePost'

interface FetchPostOptions {
  authorization?: string | null
  cookie?: string | null
}

function getApiBaseUrl(): string {
  return (process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000').replace(/\/$/, '')
}

/**
 * @deprecated Use normalizePostFromApi from @/utils/normalizePost instead.
 * Kept temporarily for backward compatibility with tests.
 */
export function normalizePostPayload(post: any): any {
  const transformedPost = transformApiResponse(post)
  return normalizePostFromApi(transformedPost) ?? transformedPost
}

/**
 * FETCH POST FROM BACKEND
 * 
 * ARCHITECTURAL SECURITY INVARIANT:
 * Individual post visibility is strictly authorization-sensitive.
 * This fetch MUST NEVER use ISR or Next.js revalidation (e.g., `revalidate: 60`).
 * 
 * Historical Context: A temporal privacy leak occurred when a post transitioned
 * from public to private, but the frontend served a stale ISR cached response
 * to guest users for up to 60 seconds.
 * 
 * To prevent this class of bugs, `cache: 'no-store'` is mandatory.
 */

async function fetchPostFromBackend(postId: string, options: FetchPostOptions = {}): Promise<Response> {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (options.authorization) {
    headers.set('Authorization', options.authorization)
  }

  if (options.cookie) {
    headers.set('Cookie', options.cookie)
  }

  // SECURITY INVARIANT: Individual post visibility is authorization-sensitive.
  // Anonymous/unauthenticated fetches MUST use cache: 'no-store' to prevent
  // stale ISR cache from serving content that has transitioned to private.
  // Authenticated fetches also bypass cache to reflect current user permissions.
  const fetchOptions: RequestInit = {
    method: 'GET',
    headers,
    cache: 'no-store',
  }

  return fetch(`${getApiBaseUrl()}/api/v1/posts/${postId}`, fetchOptions)
}

export async function fetchNormalizedPost(
  postId: string,
  options: FetchPostOptions = {}
): Promise<{ status: number; post: any | null }> {
  try {
    const response = await fetchPostFromBackend(postId, options)

    if (!response.ok) {
      return { status: response.status, post: null }
    }

    const post = await response.json()
    return { status: response.status, post: normalizePostPayload(post) }
  } catch (error) {
    console.error('Error fetching post:', error)
    return { status: 500, post: null }
  }
}

/**
 * FETCH PUBLIC POST
 * 
 * Used during the SSR phase to bootstrap public post data.
 * 
 * SECURITY INVARIANT:
 * This function relies on `fetchPostFromBackend` which is hardcoded to `cache: 'no-store'`.
 * Do NOT add Next.js caching options (like `revalidate`) here. If a public post is transitioned
 * to private, it must immediately return a 404 or access denied to guest users. Stale cache
 * serving is unacceptable for privacy-sensitive user content.
 */

export async function fetchPublicPost(postId: string): Promise<any | null> {
  const result = await fetchNormalizedPost(postId)
  const post = result.post

  // Security Hardening: Ensure SSR ONLY returns globally public content.
  // Anonymous bootstrap payloads must never contain private or custom-restricted data.
  if (post && post.privacyLevel !== 'public') {
    console.warn(`[SECURITY] Private post ${postId} leaked to anonymous SSR fetch. Blocking bootstrap payload.`)
    return null
  }

  return post
}

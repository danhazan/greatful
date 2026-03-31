import { transformApiResponse } from '@/lib/caseTransform'

interface FetchPostOptions {
  authorization?: string | null
  cookie?: string | null
  revalidate?: number
}

function getApiBaseUrl(): string {
  return (process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000').replace(/\/$/, '')
}

function toAbsoluteUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  return `${getApiBaseUrl()}${url.startsWith('/') ? url : `/${url}`}`
}

export function normalizePostPayload(post: any): any {
  const transformedPost = transformApiResponse(post)

  if (transformedPost.author) {
    transformedPost.author.id = String(transformedPost.author.id)

    const authorImage = transformedPost.author.image || transformedPost.author.profileImageUrl
    if (authorImage) {
      const normalizedAuthorImage = toAbsoluteUrl(authorImage)
      transformedPost.author.profileImageUrl = normalizedAuthorImage
      transformedPost.author.image = normalizedAuthorImage
    }
  }

  if (transformedPost.imageUrl) {
    transformedPost.imageUrl = toAbsoluteUrl(transformedPost.imageUrl)
  }

  if (Array.isArray(transformedPost.images)) {
    transformedPost.images.forEach((img: any) => {
      img.thumbnailUrl = toAbsoluteUrl(img.thumbnailUrl) || ''
      img.mediumUrl = toAbsoluteUrl(img.mediumUrl) || ''
      img.originalUrl = toAbsoluteUrl(img.originalUrl) || ''
    })
  }

  return transformedPost
}

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

  const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
    method: 'GET',
    headers,
  }

  if (!options.authorization && !options.cookie) {
    fetchOptions.next = { revalidate: options.revalidate ?? 60 }
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

export async function fetchPublicPost(postId: string): Promise<any | null> {
  const result = await fetchNormalizedPost(postId, { revalidate: 60 })
  return result.post
}

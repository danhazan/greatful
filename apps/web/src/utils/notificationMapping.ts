/**
 * Notification mapping utilities for transforming backend notifications to frontend format.
 * Handles URL normalization and consistent field mapping.
 */

import { stripHtmlTags } from '@/utils/htmlUtils'

/**
 * Converts relative URLs to absolute URLs using the API base URL.
 */
export function toAbsoluteUrl(url?: string): string | undefined {
  if (!url) return undefined

  // Already absolute URL
  if (/^https?:\/\//i.test(url)) return url

  // Get base URL from environment
  const base = process.env['NEXT_PUBLIC_API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'

  // Handle relative URLs
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`
}

/**
 * Maps backend notification to frontend format with consistent field names.
 */
export function mapBackendNotificationToFrontend(n: any) {
  // Handle both camelCase and snake_case field names for backward compatibility
  const fu = n.fromUser || n.from_user || n.data?.fromUser || n.data?.from_user || null

  // Get image from backend (handle both camelCase and snake_case)
  const image = fu?.image ?? fu?.profileImageUrl ?? fu?.profile_image_url ?? null

  // Create fromUser object if we have user data or can extract from data
  let fromUser = undefined
  if (fu) {
    fromUser = {
      id: String(fu.id ?? n.data?.actorUserId ?? n.data?.actor_user_id ?? ""),
      name: fu.name ?? fu.displayName ?? fu.display_name ?? fu.username ?? "Unknown",
      username: fu.username ?? null,
      image: toAbsoluteUrl(image) || undefined, // Convert to absolute URL
    }
  } else if (n.data?.actorUserId || n.data?.actor_user_id) {
    // Fallback: create minimal fromUser from data
    fromUser = {
      id: String(n.data.actorUserId || n.data.actor_user_id),
      name: "Unknown",
      username: null,
      image: undefined,
    }
  }

  // Handle timestamp fields (both camelCase and snake_case)
  const createdAt = n.createdAt || n.created_at
  const lastUpdatedAt = n.lastUpdatedAt || n.last_updated_at || n.updatedAt || n.updated_at

  return {
    id: n.id,
    type: n.type === "emoji_reaction" ? "reaction" : n.type,
    message: stripHtmlTags(n.message || ""),
    postId: n.postId || n.post_id || n.data?.postId || n.data?.post_id || "",
    createdAt: createdAt ? (
      createdAt.endsWith('Z')
        ? createdAt
        : createdAt.replace(' ', 'T') + 'Z'
    ) : createdAt,
    lastUpdatedAt: lastUpdatedAt ? (
      lastUpdatedAt.endsWith('Z')
        ? lastUpdatedAt
        : lastUpdatedAt.replace(' ', 'T') + 'Z'
    ) : lastUpdatedAt,
    read: n.read,
    // Batching fields (handle both camelCase and snake_case)
    isBatch: n.isBatch || n.is_batch || false,
    batchCount: n.batchCount || n.batch_count || 1,
    parentId: n.parentId || n.parent_id || null,
    // Normalized fromUser object
    fromUser,
  }
}

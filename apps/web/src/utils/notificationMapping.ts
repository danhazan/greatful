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
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  
  // Handle relative URLs
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`
}

/**
 * Maps backend notification to frontend format with consistent field names.
 */
export function mapBackendNotificationToFrontend(n: any) {
  const fu = n.from_user || n.data?.from_user || null
  
  // Get image from backend's 'image' field (preferred) or fallback to 'profile_image_url'
  const image = fu?.image ?? fu?.profile_image_url ?? null
  
  // Create fromUser object if we have user data or can extract from data
  let fromUser = undefined
  if (fu) {
    fromUser = {
      id: String(fu.id ?? n.data?.actor_user_id ?? ""),
      name: fu.name ?? fu.display_name ?? fu.username ?? "Unknown",
      username: fu.username ?? null,
      image: toAbsoluteUrl(image) || undefined, // Convert to absolute URL
    }
  } else if (n.data?.actor_user_id) {
    // Fallback: create minimal fromUser from data
    fromUser = {
      id: String(n.data.actor_user_id),
      name: "Unknown",
      username: null,
      image: undefined,
    }
  }
  
  return {
    id: n.id,
    type: n.type === "emoji_reaction" ? "reaction" : n.type,
    message: stripHtmlTags(n.message || ""),
    postId: n.post_id || n.data?.post_id || "",
    createdAt: n.created_at ? (
      n.created_at.endsWith('Z') 
        ? n.created_at 
        : n.created_at.replace(' ', 'T') + 'Z'
    ) : n.created_at,
    lastUpdatedAt: n.last_updated_at ? (
      n.last_updated_at.endsWith('Z') 
        ? n.last_updated_at 
        : n.last_updated_at.replace(' ', 'T') + 'Z'
    ) : n.last_updated_at,
    read: n.read,
    // Batching fields
    isBatch: n.is_batch || false,
    batchCount: n.batch_count || 1,
    parentId: n.parent_id || null,
    // Normalized fromUser object
    fromUser,
  }
}
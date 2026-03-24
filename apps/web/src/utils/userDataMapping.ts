/**
 * User data mapping utilities for consistent field normalization across the app.
 * Ensures profile_image_url is always mapped to image field for consistency.
 */

import { UserSearchResult } from '@/types/userSearch'

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || "http://localhost:8000"

export function toAbsoluteImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.startsWith("http") ? url : `${API_BASE_URL}${url}`
}

/**
 * Normalizes user data from backend to frontend format with consistent field names.
 * Maps profileImageUrl to image field for compatibility with components.
 * Ensures all image URLs are absolute URLs pointing to the backend/CDN.
 */
export function normalizeUserData(user: any) {
  if (!user) return user

  // Get the raw image URL from either field
  const rawImage = user.profileImageUrl || user.image || user.profile_image_url || null

  // Convert relative URLs to absolute URLs
  const absoluteImage = toAbsoluteImageUrl(rawImage)

  return {
    ...user,
    // Always ensure profileImageUrl and image fields are available
    profileImageUrl: absoluteImage,
    image: absoluteImage,
    // Ensure displayName and name fields are available
    displayName: user.displayName || user.name || user.display_name || user.username,
    name: user.name || user.displayName || user.username,
  }
}

/**
 * Normalizes an array of user objects
 */
export function normalizeUserDataArray(users: any[]) {
  if (!Array.isArray(users)) return users
  return users.map(normalizeUserData)
}

export type ApiUserPartial = {
  id: number
  username?: string
  name?: string
  display_name?: string
  displayName?: string
  profile_image_url?: string
  profileImageUrl?: string
  image?: string
  bio?: string
}

/**
 * Normalizes user data strictly to the UserSearchResult interface.
 * Provides fallbacks for display names and enforces absolute image URLs.
 */
export function normalizeToUserSearchResult(apiUser: ApiUserPartial): UserSearchResult {
  const rawImage = apiUser.profileImageUrl || apiUser.profile_image_url || apiUser.image || null
  const absoluteImage = toAbsoluteImageUrl(rawImage)
  
  return {
    id: apiUser.id,
    username: apiUser.username || `user${apiUser.id}`,
    displayName: apiUser.displayName || apiUser.display_name || apiUser.name || apiUser.username,
    profileImageUrl: absoluteImage,
    bio: apiUser.bio
  }
}

/**
 * Deduplicates an array of UserSearchResult objects based on their IDs.
 * Preserves the order of the first occurrence.
 */
export function dedupeUsersById(users: UserSearchResult[]): UserSearchResult[] {
  const userMap = new Map<number, UserSearchResult>()
  const order: number[] = []

  for (const u of users) {
    if (!userMap.has(u.id)) {
      order.push(u.id)
      userMap.set(u.id, u)
    } else {
      // Merge with existing, prioritizing new fields if they exist
      const existing = userMap.get(u.id)!
      userMap.set(u.id, {
        ...existing,
        ...u,
        // Ensure we don't overwrite with undefined/null if existing had a value
        displayName: u.displayName || existing.displayName,
        profileImageUrl: u.profileImageUrl || existing.profileImageUrl,
        bio: u.bio || existing.bio
      })
    }
  }

  return order.map(id => userMap.get(id)!)
}

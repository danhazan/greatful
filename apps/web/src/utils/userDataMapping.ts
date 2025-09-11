/**
 * User data mapping utilities for consistent field normalization across the app.
 * Ensures profile_image_url is always mapped to image field for consistency.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/**
 * Normalizes user data from backend to frontend format with consistent field names.
 * Maps profile_image_url to image field for compatibility with components.
 * Ensures all image URLs are absolute URLs pointing to the backend/CDN.
 */
export function normalizeUserData(user: any) {
  if (!user) return user
  
  // Get the raw image URL from either field
  const rawImage = user.image || user.profile_image_url || null
  
  // Convert relative URLs to absolute URLs
  const absoluteImage = rawImage && rawImage.startsWith("http")
    ? rawImage
    : rawImage
      ? `${API_BASE_URL}${rawImage}`
      : null
  
  return {
    ...user,
    // Always ensure image field is available (preferred by components)
    image: absoluteImage,
    // Keep original field for backward compatibility but also make it absolute
    profile_image_url: absoluteImage,
    // Ensure name field is available
    name: user.name || user.display_name || user.username,
  }
}

/**
 * Normalizes an array of user objects
 */
export function normalizeUserDataArray(users: any[]) {
  if (!Array.isArray(users)) return users
  return users.map(normalizeUserData)
}
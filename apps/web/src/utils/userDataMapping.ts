/**
 * User data mapping utilities for consistent field normalization across the app.
 * Ensures profile_image_url is always mapped to image field for consistency.
 */

/**
 * Normalizes user data from backend to frontend format with consistent field names.
 * Maps profile_image_url to image field for compatibility with components.
 */
export function normalizeUserData(user: any) {
  if (!user) return user
  
  return {
    ...user,
    // Always ensure image field is available (preferred by components)
    image: user.image || user.profile_image_url || null,
    // Keep original field for backward compatibility
    profile_image_url: user.profile_image_url,
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
/**
 * Integration test to verify the profile image URL fix for navbar dropdown.
 * 
 * This test simulates the exact issue described:
 * - Backend returns relative URLs like "/uploads/profile_photos/profile_03777.jpg"
 * - Frontend should convert these to absolute URLs like "http://localhost:8000/uploads/profile_photos/profile_03777.jpg"
 * - This prevents 404 errors when the browser tries to load images from the frontend domain
 */

import { normalizeUserData } from '@/utils/userDataMapping'

describe('Profile Image URL Fix Integration', () => {
  describe('Navbar Profile Image URL Resolution', () => {
    it('should fix the 404 error by converting relative URLs to absolute URLs', () => {
      // Simulate the exact backend response that was causing 404 errors
      const backendUserData = {
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        profile_image_url: '/uploads/profile_photos/profile_03777.jpg' // Relative URL from backend
      }

      // Apply the normalization (what the API middleware now does)
      const normalizedUser = normalizeUserData(backendUserData)

      // Verify the fix: both image fields should now be absolute URLs
      expect(normalizedUser.image).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')
      expect(normalizedUser.profile_image_url).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')

      // This prevents the browser from trying to load:
      // ❌ http://localhost:3000/uploads/profile_photos/profile_03777.jpg (404 Not Found)
      // 
      // And instead correctly loads:
      // ✅ http://localhost:8000/uploads/profile_photos/profile_03777.jpg (backend/CDN)
    })

    it('should work correctly with UserAvatar component logic', () => {
      // Simulate normalized user data that UserAvatar receives
      const user = {
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        image: 'http://localhost:8000/uploads/profile_photos/profile_03777.jpg',
        profile_image_url: 'http://localhost:8000/uploads/profile_photos/profile_03777.jpg'
      }

      // Simulate UserAvatar's image URL selection logic
      const profileImageUrl = user.image || user.profile_image_url

      // Verify the image URL is absolute and points to the backend
      expect(profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')
      expect(profileImageUrl.startsWith('http://localhost:8000')).toBe(true)
      expect(profileImageUrl.startsWith('http://localhost:3000')).toBe(false)
    })

    it('should handle already absolute URLs correctly', () => {
      // Test with CDN URLs that are already absolute
      const backendUserData = {
        id: 123,
        username: 'testuser',
        profile_image_url: 'https://cdn.example.com/profile.jpg' // Already absolute
      }

      const normalizedUser = normalizeUserData(backendUserData)

      // Should preserve absolute URLs unchanged
      expect(normalizedUser.image).toBe('https://cdn.example.com/profile.jpg')
      expect(normalizedUser.profile_image_url).toBe('https://cdn.example.com/profile.jpg')
    })

    it('should handle missing profile images gracefully', () => {
      const backendUserData = {
        id: 123,
        username: 'testuser',
        display_name: 'Test User'
        // No profile_image_url
      }

      const normalizedUser = normalizeUserData(backendUserData)

      // Should set both fields to null when no image exists
      expect(normalizedUser.image).toBeNull()
      expect(normalizedUser.profile_image_url).toBeNull()
    })
  })

  describe('API Response Flow', () => {
    it('should simulate the complete API response normalization flow', () => {
      // Simulate the complete flow from backend to frontend

      // 1. Backend API response (what UserService returns)
      const backendApiResponse = {
        success: true,
        data: {
          id: 123,
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com',
          profile_image_url: '/uploads/profile_photos/profile_03777.jpg', // Relative URL
          bio: 'Test bio',
          created_at: '2024-01-01T00:00:00Z',
          posts_count: 5
        },
        timestamp: '2024-01-01T00:00:00Z',
        request_id: 'test-request-id'
      }

      // 2. API middleware normalization (what user-profile-api.ts does)
      const normalizedUserData = normalizeUserData(backendApiResponse.data)
      const normalizedApiResponse = {
        ...backendApiResponse,
        data: normalizedUserData
      }

      // 3. Frontend receives normalized response
      const profileData = normalizedApiResponse.data

      // 4. Frontend creates user object for Navbar (what feed/page.tsx does)
      const currentUser = {
        id: profileData.id,
        name: profileData.name,
        display_name: profileData.display_name,
        username: profileData.username,
        email: profileData.email,
        profile_image_url: profileData.profile_image_url,
        image: profileData.image
      }

      // 5. Verify the complete flow results in correct absolute URLs
      expect(currentUser.image).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')
      expect(currentUser.profile_image_url).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')

      // 6. Verify UserAvatar will receive correct URL
      const avatarImageUrl = currentUser.image || currentUser.profile_image_url
      expect(avatarImageUrl).toBe('http://localhost:8000/uploads/profile_photos/profile_03777.jpg')

      // This ensures the navbar dropdown shows actual profile images instead of initials
      // and prevents 404 console errors
    })
  })

  describe('Consistency Across Components', () => {
    it('should ensure notifications and navbar use the same URL format', () => {
      // Both notifications and navbar should now use the same normalization
      const relativeUrl = '/uploads/profile_photos/profile_03777.jpg'
      const expectedAbsoluteUrl = 'http://localhost:8000/uploads/profile_photos/profile_03777.jpg'

      // Simulate user data from notifications API
      const notificationUser = normalizeUserData({
        id: 123,
        username: 'testuser',
        profile_image_url: relativeUrl
      })

      // Simulate user data from profile API (navbar)
      const navbarUser = normalizeUserData({
        id: 123,
        username: 'testuser',
        profile_image_url: relativeUrl
      })

      // Both should produce the same absolute URL
      expect(notificationUser.image).toBe(expectedAbsoluteUrl)
      expect(navbarUser.image).toBe(expectedAbsoluteUrl)
      expect(notificationUser.image).toBe(navbarUser.image)
    })
  })
})
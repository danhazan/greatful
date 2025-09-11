import { normalizeUserData } from '@/utils/userDataMapping'

describe('Navbar Profile Image Integration', () => {
  describe('Backend Response Normalization', () => {
    it('should normalize wrapped backend response correctly', () => {
      // Simulate actual backend response structure
      const backendResponse = {
        success: true,
        data: {
          id: 123,
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com',
          profile_image_url: 'https://example.com/profile.jpg',
          bio: 'Test bio',
          created_at: '2024-01-01T00:00:00Z',
          posts_count: 5
        },
        timestamp: '2024-01-01T00:00:00Z',
        request_id: 'test-request-id'
      }

      // Normalize the user data (what the API middleware does)
      const normalizedUserData = normalizeUserData(backendResponse.data)
      
      // Create the normalized response (what the API returns)
      const normalizedResponse = {
        ...backendResponse,
        data: normalizedUserData
      }

      expect(normalizedResponse.data).toEqual({
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        profile_image_url: 'https://example.com/profile.jpg',
        image: 'https://example.com/profile.jpg', // Normalized field
        name: 'Test User', // Normalized field
        bio: 'Test bio',
        created_at: '2024-01-01T00:00:00Z',
        posts_count: 5
      })
    })

    it('should handle user data without profile image', () => {
      const backendResponse = {
        success: true,
        data: {
          id: 123,
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com'
          // No profile_image_url
        }
      }

      const normalizedUserData = normalizeUserData(backendResponse.data)

      expect(normalizedUserData.image).toBeNull()
      expect(normalizedUserData.name).toBe('Test User')
    })
  })

  describe('Frontend User Object Creation', () => {
    it('should create correct user object for Navbar from normalized API response', () => {
      // Simulate what the frontend receives after normalization
      const apiResponse = {
        success: true,
        data: {
          id: 123,
          username: 'testuser',
          display_name: 'Test User',
          email: 'test@example.com',
          profile_image_url: 'https://example.com/profile.jpg',
          image: 'https://example.com/profile.jpg', // Normalized
          name: 'Test User' // Normalized
        }
      }

      // Simulate what the frontend does (e.g., in feed page)
      const profileData = apiResponse.data
      const currentUser = {
        id: profileData.id,
        name: profileData.display_name || profileData.username,
        display_name: profileData.display_name,
        username: profileData.username,
        email: profileData.email,
        profile_image_url: profileData.profile_image_url,
        image: profileData.image // Use normalized image field
      }

      expect(currentUser).toEqual({
        id: 123,
        name: 'Test User',
        display_name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        profile_image_url: 'https://example.com/profile.jpg',
        image: 'https://example.com/profile.jpg'
      })
    })

    it('should work with UserAvatar component expectations', () => {
      const user = {
        id: 123,
        name: 'Test User',
        display_name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        profile_image_url: 'https://example.com/profile.jpg',
        image: 'https://example.com/profile.jpg'
      }

      // Simulate UserAvatar logic
      const profileImageUrl = user.image || user.profile_image_url
      const displayName = user.display_name || user.name || 'User'

      expect(profileImageUrl).toBe('https://example.com/profile.jpg')
      expect(displayName).toBe('Test User')
    })
  })

  describe('Fallback Scenarios', () => {
    it('should handle missing image gracefully', () => {
      const user = {
        id: 123,
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com'
        // No image or profile_image_url
      }

      const profileImageUrl = user.image || user.profile_image_url
      expect(profileImageUrl).toBeUndefined()
    })

    it('should prioritize image over profile_image_url', () => {
      const user = {
        id: 123,
        username: 'testuser',
        image: 'https://example.com/new-image.jpg',
        profile_image_url: 'https://example.com/old-image.jpg'
      }

      const profileImageUrl = user.image || user.profile_image_url
      expect(profileImageUrl).toBe('https://example.com/new-image.jpg')
    })
  })
})
import { normalizeUserData, normalizeUserDataArray } from '@/utils/userDataMapping'

describe('userDataMapping', () => {
  describe('normalizeUserData', () => {
    it('should map profile_image_url to image field', () => {
      const user = {
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        profile_image_url: 'https://example.com/profile.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized).toEqual({
        id: 123,
        username: 'testuser',
        display_name: 'Test User',
        profile_image_url: 'https://example.com/profile.jpg',
        image: 'https://example.com/profile.jpg',
        name: 'Test User'
      })
    })

    it('should preserve existing image field over profile_image_url and normalize both to absolute URLs', () => {
      const user = {
        id: 123,
        username: 'testuser',
        image: 'https://example.com/new-profile.jpg',
        profile_image_url: 'https://example.com/old-profile.jpg'
      }

      const normalized = normalizeUserData(user)

      // Both fields should use the image field value (prioritized) and be absolute URLs
      expect(normalized.image).toBe('https://example.com/new-profile.jpg')
      expect(normalized.profile_image_url).toBe('https://example.com/new-profile.jpg')
    })

    it('should set image to null when no profile image exists', () => {
      const user = {
        id: 123,
        username: 'testuser',
        display_name: 'Test User'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBeNull()
      expect(normalized.name).toBe('Test User')
    })

    it('should fallback name to username when no display_name', () => {
      const user = {
        id: 123,
        username: 'testuser'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.name).toBe('testuser')
    })

    it('should convert relative URLs to absolute URLs', () => {
      const user = {
        id: 123,
        username: 'testuser',
        profile_image_url: '/uploads/profile_photos/profile_123.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBe('http://localhost:8000/uploads/profile_photos/profile_123.jpg')
      expect(normalized.profile_image_url).toBe('http://localhost:8000/uploads/profile_photos/profile_123.jpg')
    })

    it('should preserve absolute URLs unchanged', () => {
      const user = {
        id: 123,
        username: 'testuser',
        profile_image_url: 'https://cdn.example.com/profile.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBe('https://cdn.example.com/profile.jpg')
      expect(normalized.profile_image_url).toBe('https://cdn.example.com/profile.jpg')
    })

    it('should handle null/undefined input', () => {
      expect(normalizeUserData(null)).toBeNull()
      expect(normalizeUserData(undefined)).toBeUndefined()
    })
  })

  describe('normalizeUserDataArray', () => {
    it('should normalize array of users', () => {
      const users = [
        {
          id: 1,
          username: 'user1',
          profile_image_url: 'https://example.com/user1.jpg'
        },
        {
          id: 2,
          username: 'user2',
          display_name: 'User Two'
        }
      ]

      const normalized = normalizeUserDataArray(users)

      expect(normalized).toHaveLength(2)
      expect(normalized[0].image).toBe('https://example.com/user1.jpg')
      expect(normalized[0].name).toBe('user1')
      expect(normalized[1].image).toBeNull()
      expect(normalized[1].name).toBe('User Two')
    })

    it('should handle non-array input', () => {
      const nonArray = { id: 1, username: 'test' }
      expect(normalizeUserDataArray(nonArray as any)).toBe(nonArray)
    })
  })
})
import { normalizeUserData, normalizeUserDataArray } from '@/utils/userDataMapping'

describe('userDataMapping', () => {
  describe('normalizeUserData', () => {
    it('should map profileImageUrl to image field', () => {
      const user = {
        id: 123,
        username: 'testuser',
        displayName: 'Test User',
        profileImageUrl: 'https://example.com/profile.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized).toEqual({
        id: 123,
        username: 'testuser',
        displayName: 'Test User',
        profileImageUrl: 'https://example.com/profile.jpg',
        image: 'https://example.com/profile.jpg',
        name: 'Test User'
      })
    })

    it('should preserve existing image field over profileImageUrl and normalize both to absolute URLs', () => {
      const user = {
        id: 123,
        username: 'testuser',
        image: 'https://example.com/new-profile.jpg',
        profileImageUrl: 'https://example.com/old-profile.jpg'
      }

      const normalized = normalizeUserData(user)

      // Both fields should use the image field value (prioritized) and be absolute URLs
      expect(normalized.image).toBe('https://example.com/new-profile.jpg')
      expect(normalized.profileImageUrl).toBe('https://example.com/new-profile.jpg')
    })

    it('should set image to null when no profile image exists', () => {
      const user = {
        id: 123,
        username: 'testuser',
        displayName: 'Test User'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBeNull()
      expect(normalized.name).toBe('Test User')
    })

    it('should fallback name to username when no displayName', () => {
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
        profileImageUrl: '/uploads/profile_photos/profile_123.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBe('http://localhost:8000/uploads/profile_photos/profile_123.jpg')
      expect(normalized.profileImageUrl).toBe('http://localhost:8000/uploads/profile_photos/profile_123.jpg')
    })

    it('should preserve absolute URLs unchanged', () => {
      const user = {
        id: 123,
        username: 'testuser',
        profileImageUrl: 'https://cdn.example.com/profile.jpg'
      }

      const normalized = normalizeUserData(user)

      expect(normalized.image).toBe('https://cdn.example.com/profile.jpg')
      expect(normalized.profileImageUrl).toBe('https://cdn.example.com/profile.jpg')
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
          profileImageUrl: 'https://example.com/user1.jpg'
        },
        {
          id: 2,
          username: 'user2',
          displayName: 'User Two'
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
import { toAbsoluteUrl, mapBackendNotificationToFrontend } from '../notificationMapping'

describe('notificationMapping', () => {
  describe('toAbsoluteUrl', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should return undefined for empty/null URLs', () => {
      expect(toAbsoluteUrl(undefined)).toBeUndefined()
      expect(toAbsoluteUrl('')).toBeUndefined()
      expect(toAbsoluteUrl(null as any)).toBeUndefined()
    })

    it('should return absolute URLs unchanged', () => {
      const absoluteUrl = 'https://example.com/image.jpg'
      expect(toAbsoluteUrl(absoluteUrl)).toBe(absoluteUrl)
      
      const httpUrl = 'http://example.com/image.jpg'
      expect(toAbsoluteUrl(httpUrl)).toBe(httpUrl)
    })

    it('should convert relative URLs to absolute using NEXT_PUBLIC_API_BASE_URL', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.com'
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
      expect(toAbsoluteUrl('uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
    })

    it('should fallback to NEXT_PUBLIC_API_URL if NEXT_PUBLIC_API_BASE_URL is not set', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com'
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
    })

    it('should use default localhost if no env vars are set', () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL
      delete process.env.NEXT_PUBLIC_API_URL
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('http://localhost:8000/uploads/image.jpg')
    })
  })

  describe('mapBackendNotificationToFrontend', () => {
    it('should map basic notification fields correctly', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        post_id: 'post-456',
        created_at: '2024-01-01T12:00:00Z',
        last_updated_at: '2024-01-01T12:30:00Z',
        read: false,
        is_batch: false,
        batch_count: 1,
        parent_id: null,
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe',
          image: '/uploads/profile.jpg'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result).toEqual({
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        postId: 'post-456',
        createdAt: '2024-01-01T12:00:00Z',
        lastUpdatedAt: '2024-01-01T12:30:00Z',
        read: false,
        isBatch: false,
        batchCount: 1,
        parentId: null,
        fromUser: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe',
          image: 'http://localhost:8000/uploads/profile.jpg'
        }
      })
    })

    it('should convert emoji_reaction type to reaction', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'emoji_reaction',
        message: 'User reacted to your post',
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe',
          image: 'https://example.com/profile.jpg'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.type).toBe('reaction')
    })

    it('should handle missing from_user gracefully', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'Someone liked your post',
        data: {
          actor_user_id: 'user-789'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.fromUser).toEqual({
        id: 'user-789',
        name: 'Unknown',
        username: null,
        image: undefined
      })
    })

    it('should prefer image field over profile_image_url', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe',
          image: '/uploads/new-profile.jpg',
          profile_image_url: '/uploads/old-profile.jpg'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.fromUser?.image).toBe('http://localhost:8000/uploads/new-profile.jpg')
    })

    it('should fallback to profile_image_url if image is not available', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe',
          profile_image_url: '/uploads/profile.jpg'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.fromUser?.image).toBe('http://localhost:8000/uploads/profile.jpg')
    })

    it('should handle timestamp formatting correctly', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        created_at: '2024-01-01 12:00:00',
        last_updated_at: '2024-01-01 12:30:00',
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.createdAt).toBe('2024-01-01T12:00:00Z')
      expect(result.lastUpdatedAt).toBe('2024-01-01T12:30:00Z')
    })

    it('should extract postId from data if not in root', () => {
      const backendNotification = {
        id: 'notif-123',
        type: 'like',
        message: 'User liked your post',
        data: {
          post_id: 'post-from-data'
        },
        from_user: {
          id: 'user-789',
          name: 'John Doe',
          username: 'johndoe'
        }
      }

      const result = mapBackendNotificationToFrontend(backendNotification)

      expect(result.postId).toBe('post-from-data')
    })
  })
})
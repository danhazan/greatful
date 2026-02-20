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
      process.env['NEXT_PUBLIC_API_BASE_URL'] = 'https://api.example.com'
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
      expect(toAbsoluteUrl('uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
    })

    it('should fallback to NEXT_PUBLIC_API_URL if NEXT_PUBLIC_API_BASE_URL is not set', () => {
      process.env['NEXT_PUBLIC_API_URL'] = 'https://api.example.com'
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('https://api.example.com/uploads/image.jpg')
    })

    it('should use default localhost if no env vars are set', () => {
      delete process.env['NEXT_PUBLIC_API_BASE_URL']
      delete process.env['NEXT_PUBLIC_API_URL']
      
      expect(toAbsoluteUrl('/uploads/image.jpg')).toBe('http://localhost:8000/uploads/image.jpg')
    })
  })

  describe('mapBackendNotificationToFrontend', () => {
    it('should map basic notification fields correctly', () => {
      const backendNotification = {
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

    it('should handle batch children with nested from_user in data', () => {
      // Simulate batch child notification structure
      const batchChildNotification = {
        id: 'child-123',
        type: 'emoji_reaction',
        message: 'User reacted to your post',
        post_id: 'post-456',
        data: {
          post_id: 'post-456',
          actor_username: 'jane_doe',
          actor_user_id: '789',
          from_user: {
            id: '789',
            name: 'Jane Doe',
            username: 'jane_doe',
            image: 'https://example.com/jane.jpg'
          }
        },
        created_at: '2023-01-01T12:00:00Z'
      }

      const result = mapBackendNotificationToFrontend(batchChildNotification)

      expect(result.fromUser).toEqual({
        id: '789',
        name: 'Jane Doe',
        username: 'jane_doe',
        image: 'https://example.com/jane.jpg'
      })
      expect(result.type).toBe('reaction')
      expect(result.postId).toBe('post-456')
    })

    it('should handle regular notifications with top-level from_user', () => {
      // Simulate regular notification structure
      const regularNotification = {
        id: 'regular-123',
        type: 'like',
        message: 'User liked your post',
        post_id: 'post-789',
        from_user: {
          id: '456',
          name: 'Bob Smith',
          username: 'bob_smith',
          profile_image_url: '/images/bob.png'
        },
        created_at: '2023-01-01T12:00:00Z'
      }

      const result = mapBackendNotificationToFrontend(regularNotification)

      expect(result.fromUser).toEqual({
        id: '456',
        name: 'Bob Smith',
        username: 'bob_smith',
        image: expect.stringContaining('/images/bob.png') // Should be converted to absolute URL
      })
      expect(result.type).toBe('like')
      expect(result.postId).toBe('post-789')
    })

    it('should prefer top-level fromUser over nested data.fromUser', () => {
      // Test priority: top-level fromUser should win
      const notificationWithBoth = {
        id: 'both-123',
        type: 'reaction',
        message: 'User reacted',
        fromUser: {
          id: '111',
          name: 'Top Level User',
          username: 'toplevel',
          image: 'https://example.com/top.jpg'
        },
        data: {
          fromUser: {
            id: '222',
            name: 'Nested User',
            username: 'nested',
            image: 'https://example.com/nested.jpg'
          }
        }
      }

      const result = mapBackendNotificationToFrontend(notificationWithBoth)

      expect(result.fromUser).toEqual({
        id: '111',
        name: 'Top Level User',
        username: 'toplevel',
        image: 'https://example.com/top.jpg'
      })
    })
  })
})
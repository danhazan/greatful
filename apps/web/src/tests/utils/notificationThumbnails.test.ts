import {
  resolveNotificationThumbnailUrl,
  shouldDisableNotificationProfileNavigation
} from '@/utils/notificationThumbnails'

describe('notificationThumbnails', () => {
  it('uses actor avatar for regular notifications', () => {
    const notification: any = {
      fromUser: { image: 'https://example.com/avatar.jpg' },
      data: {}
    }

    expect(resolveNotificationThumbnailUrl(notification)).toBe('https://example.com/avatar.jpg')
    expect(shouldDisableNotificationProfileNavigation(notification)).toBe(false)
  })

  it('uses image thumbnail when notification data provides one', () => {
    const notification: any = {
      fromUser: { image: 'https://example.com/avatar.jpg' },
      data: {
        thumbnail_type: 'image',
        thumbnail_url: '/uploads/posts/image_thumb.jpg'
      }
    }

    expect(resolveNotificationThumbnailUrl(notification)).toBe('http://localhost:8000/uploads/posts/image_thumb.jpg')
    expect(shouldDisableNotificationProfileNavigation(notification)).toBe(true)
  })

  it('falls back to actor avatar when image thumbnail is missing', () => {
    const notification: any = {
      fromUser: { image: 'https://example.com/avatar.jpg' },
      data: {
        thumbnail_type: 'image',
        object_id: 'image-123'
      }
    }

    expect(resolveNotificationThumbnailUrl(notification)).toBe('https://example.com/avatar.jpg')
    expect(shouldDisableNotificationProfileNavigation(notification)).toBe(false)
  })
})

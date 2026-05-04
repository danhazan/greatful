import { Notification } from '@/types/notification'
import { toAbsoluteUrl } from '@/utils/notificationMapping'

function getThumbnailType(notification: Notification): string | undefined {
  return notification.data?.thumbnailType ?? notification.data?.thumbnail_type
}

function getThumbnailUrl(notification: Notification): string | undefined {
  return notification.data?.thumbnailUrl ?? notification.data?.thumbnail_url
}

export function resolveNotificationThumbnailUrl(notification: Notification): string | undefined {
  const actorAvatar = notification.fromUser?.image

  if (getThumbnailType(notification) !== 'image') {
    return actorAvatar
  }

  const imageThumbnailUrl = getThumbnailUrl(notification)
  if (!imageThumbnailUrl) {
    return actorAvatar
  }

  return toAbsoluteUrl(imageThumbnailUrl) || actorAvatar
}

export function shouldDisableNotificationProfileNavigation(notification: Notification): boolean {
  return getThumbnailType(notification) === 'image' && Boolean(getThumbnailUrl(notification))
}

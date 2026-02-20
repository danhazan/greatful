/**
 * Notification-related TypeScript types for the Grateful application.
 */

import { User } from './user'

export type NotificationType =
    | 'reaction'
    | 'comment'
    | 'share'
    | 'follow'
    | 'mention'
    | 'like'

export interface Notification {
    id: string
    type: NotificationType
    message: string
    postId: string
    fromUser: Partial<User>
    data?: {
        actorUserId?: string
        actorUsername?: string
        [key: string]: any
    }
    createdAt: string
    lastUpdatedAt?: string
    read: boolean
    isBatch: boolean
    batchCount: number
    parentId: string | null
}

import { QueryKey } from './apiCache'

export const queryKeys = {
  feed: (): QueryKey => ['feed'],
  userPosts: (userId: string): QueryKey => ['userPosts', userId],
  userProfile: (userId: string): QueryKey => ['userProfile', userId],
  currentUserProfile: (): QueryKey => ['currentUserProfile'],
  post: (postId: string): QueryKey => ['post', postId],
  postComments: (postId: string): QueryKey => ['postComments', postId],
  postReactions: (postId: string): QueryKey => ['postReactions', postId],
} as const

export const queryTags = {
  feed: 'feed',
  userPosts: (userId: string) => `userPosts:${userId}`,
  userProfile: (userId: string) => `userProfile:${userId}`,
  currentUserProfile: 'currentUserProfile',
  post: (postId: string) => `post:${postId}`,
  postComments: (postId: string) => `postComments:${postId}`,
  postReactions: (postId: string) => `postReactions:${postId}`,
} as const

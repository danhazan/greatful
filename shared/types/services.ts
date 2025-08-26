/**
 * Service layer type definitions
 */

import { 
  User, 
  Post, 
  EmojiReaction, 
  Like, 
  Notification, 
  Share, 
  Mention, 
  Follow,
  UserPreference,
  PostFilters,
  NotificationFilters,
  ReactionFilters,
  FollowFilters,
  PaginationParams
} from './models'
import { 
  EmojiCode, 
  PostType, 
  NotificationType, 
  ShareMethod, 
  FollowStatus,
  PrivacyLevel
} from './core'

// ============================================================================
// Reaction Service Types
// ============================================================================

export interface ReactionServiceInterface {
  addReaction(userId: number, postId: string, emojiCode: EmojiCode): Promise<EmojiReaction>
  removeReaction(userId: number, postId: string): Promise<boolean>
  getPostReactions(postId: string): Promise<EmojiReaction[]>
  getUserReaction(userId: number, postId: string): Promise<EmojiReaction | null>
  getTotalReactionCount(postId: string): Promise<number>
  getReactionCounts(postId: string): Promise<Record<EmojiCode, number>>
  validateEmojiCode(emojiCode: string): boolean
}

export interface ReactionCreateData {
  user_id: number
  post_id: string
  emoji_code: EmojiCode
}

export interface ReactionUpdateData {
  emoji_code: EmojiCode
}

// ============================================================================
// Notification Service Types
// ============================================================================

export interface NotificationServiceInterface {
  createNotification(data: NotificationCreateData): Promise<Notification>
  getUserNotifications(userId: number, params?: PaginationParams): Promise<Notification[]>
  markAsRead(notificationIds: string[]): Promise<number>
  markAllAsRead(userId: number): Promise<number>
  getUnreadCount(userId: number): Promise<number>
  createBatchNotification(data: BatchNotificationCreateData): Promise<Notification>
  getNotificationChildren(parentId: string): Promise<Notification[]>
  shouldBatchNotification(data: NotificationCreateData): Promise<boolean>
}

export interface NotificationCreateData {
  user_id: number
  type: NotificationType
  message: string
  post_id?: string
  related_user_id?: number
  emoji_code?: EmojiCode
  data?: Record<string, any>
}

export interface BatchNotificationCreateData extends NotificationCreateData {
  is_batch: true
  batch_count: number
  parent_id?: string
}

export interface NotificationBatchingConfig {
  max_notifications_per_hour: number
  batch_window_minutes: number
  batch_threshold: number
}

// ============================================================================
// Share Service Types
// ============================================================================

export interface ShareServiceInterface {
  generateShareUrl(postId: string): Promise<string>
  shareViaMessage(data: ShareViaMessageData): Promise<Share[]>
  trackShareAnalytics(userId: number, postId: string, method: ShareMethod): Promise<void>
  checkRateLimit(userId: number): Promise<boolean>
  getRemainingShares(userId: number): Promise<number>
  getShareAnalytics(postId: string): Promise<ShareAnalytics>
}

export interface ShareViaMessageData {
  sender_id: number
  post_id: string
  recipient_ids: number[]
  message_content?: string
}

export interface ShareAnalytics {
  total_shares: number
  shares_by_method: Record<ShareMethod, number>
  recent_shares: Share[]
  trending_posts: string[]
}

export interface ShareRateLimit {
  user_id: number
  shares_count: number
  window_start: string
  window_end: string
}

// ============================================================================
// Mention Service Types
// ============================================================================

export interface MentionServiceInterface {
  extractMentions(content: string): Promise<string[]>
  createMentionNotifications(authorId: number, postId: string, mentions: string[]): Promise<void>
  searchUsers(query: string, limit?: number): Promise<User[]>
  validateMentionPermissions(authorId: number, mentionedUserId: number): Promise<boolean>
  getMentionedUsers(postId: string): Promise<User[]>
}

export interface MentionCreateData {
  post_id: string
  author_id: number
  mentioned_user_id: number
}

export interface UserSearchParams {
  query: string
  limit: number
  exclude_user_ids: number[]
  include_blocked: boolean
}

// ============================================================================
// Follow Service Types
// ============================================================================

export interface FollowServiceInterface {
  followUser(followerId: number, followedId: number): Promise<Follow>
  unfollowUser(followerId: number, followedId: number): Promise<boolean>
  getFollowers(userId: number, params?: PaginationParams): Promise<User[]>
  getFollowing(userId: number, params?: PaginationParams): Promise<User[]>
  isFollowing(followerId: number, followedId: number): Promise<boolean>
  getFollowStatus(followerId: number, followedId: number): Promise<FollowStatus | null>
  getFollowCounts(userId: number): Promise<FollowCounts>
}

export interface FollowCounts {
  followers_count: number
  following_count: number
}

export interface FollowCreateData {
  follower_id: number
  followed_id: number
  status: FollowStatus
}

// ============================================================================
// Algorithm Service Types
// ============================================================================

export interface AlgorithmServiceInterface {
  calculatePostScore(post: Post, userId: number): Promise<number>
  getPersonalizedFeed(userId: number, params?: PaginationParams): Promise<Post[]>
  updatePostScores(postId: string): Promise<void>
  getEngagementMetrics(postId: string): Promise<EngagementMetrics>
}

export interface EngagementMetrics {
  hearts_count: number
  reactions_count: number
  shares_count: number
  comments_count: number
  engagement_score: number
}

export interface FeedAlgorithmConfig {
  heart_weight: number
  reaction_weight: number
  share_weight: number
  photo_bonus: number
  daily_gratitude_multiplier: number
  relationship_multiplier: number
  recency_decay_hours: number
  high_score_threshold: number
  feed_mix_ratio: number // 0.8 for 80% high-scoring, 20% recent
}

export interface PostScoringFactors {
  hearts_count: number
  reactions_count: number
  shares_count: number
  has_photo: boolean
  is_daily_gratitude: boolean
  is_from_followed_user: boolean
  hours_since_creation: number
  reports_count: number
}

// ============================================================================
// User Service Types
// ============================================================================

export interface UserServiceInterface {
  getUserById(id: number): Promise<User | null>
  getUserByEmail(email: string): Promise<User | null>
  getUserByUsername(username: string): Promise<User | null>
  updateProfile(userId: number, data: UserUpdateData): Promise<User>
  getUserStats(userId: number): Promise<UserStats>
  searchUsers(params: UserSearchParams): Promise<User[]>
}

export interface UserUpdateData {
  username?: string
  bio?: string
  profile_image_url?: string
}

export interface UserStats {
  posts_count: number
  followers_count: number
  following_count: number
  total_hearts_received: number
  total_reactions_received: number
  total_shares_received: number
  join_date: string
  last_active: string
}

// ============================================================================
// Post Service Types
// ============================================================================

export interface PostServiceInterface {
  createPost(data: PostCreateData): Promise<Post>
  getPostById(id: string): Promise<Post | null>
  getUserPosts(userId: number, params?: PaginationParams): Promise<Post[]>
  getFeed(userId: number, params?: PaginationParams): Promise<Post[]>
  updatePost(postId: string, data: PostUpdateData): Promise<Post>
  deletePost(postId: string, userId: number): Promise<boolean>
  getPostEngagement(postId: string): Promise<EngagementMetrics>
}

export interface PostCreateData {
  author_id: number
  title?: string
  content: string
  post_type: PostType
  image_url?: string
  is_public: boolean
}

export interface PostUpdateData {
  title?: string
  content?: string
  image_url?: string
  is_public?: boolean
}

// ============================================================================
// Validation Service Types
// ============================================================================

export interface ValidationServiceInterface {
  validatePostContent(content: string, postType: PostType): ValidationResult
  validateEmojiCode(emojiCode: string): ValidationResult
  validateUsername(username: string): ValidationResult
  validateEmail(email: string): ValidationResult
  validatePassword(password: string): ValidationResult
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  code: string
  message: string
  value?: any
}

// ============================================================================
// Cache Service Types
// ============================================================================

export interface CacheServiceInterface {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(pattern?: string): Promise<void>
  exists(key: string): Promise<boolean>
}

export interface CacheConfig {
  default_ttl: number
  max_memory: string
  eviction_policy: 'lru' | 'lfu' | 'random'
  key_prefix: string
}

// ============================================================================
// Database Service Types
// ============================================================================

export interface DatabaseServiceInterface {
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>
  execute(sql: string, params?: any[]): Promise<number>
  transaction<T>(callback: (tx: DatabaseTransaction) => Promise<T>): Promise<T>
}

export interface DatabaseTransaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>
  execute(sql: string, params?: any[]): Promise<number>
  commit(): Promise<void>
  rollback(): Promise<void>
}
/**
 * Usage demonstration of shared types
 * This file shows practical examples of how to use the shared types
 */

import {
  // Core types
  EmojiCode,
  PostType,
  NotificationType,
  EMOJI_DISPLAY,
  POST_TYPE_LIMITS,
  
  // API types
  CreatePostRequest,
  PostResponse,
  AddReactionRequest,
  ReactionResponse,
  NotificationResponse,
  
  // Error types
  ApiErrorResponse,
  ErrorType,
  HttpStatusCode,
  createValidationError,
  
  // Validation types
  createStringSchema,
  USERNAME_VALIDATION,
  EMAIL_VALIDATION,
  getPostContentValidation
} from '../index'

// ============================================================================
// Example 1: Type-safe API request/response handling
// ============================================================================

async function createPost(postData: CreatePostRequest): Promise<PostResponse> {
  // Validate post content length based on type
  const maxLength = POST_TYPE_LIMITS[postData.post_type]
  if (postData.content.length > maxLength) {
    throw new Error(`Content too long. Maximum ${maxLength} characters for ${postData.post_type} posts`)
  }

  const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(postData)
  })

  if (!response.ok) {
    const error: ApiErrorResponse = await response.json()
    throw new Error(error.error.message)
  }

  return response.json()
}

// Usage example
async function exampleCreatePost() {
  try {
    const newPost: CreatePostRequest = {
      content: "Grateful for this beautiful sunny day! 🌞",
      post_type: PostType.SPONTANEOUS,
      title: "Daily Gratitude",
      is_public: true
    }

    const createdPost = await createPost(newPost)
    console.log('Created post:', createdPost.id)
  } catch (error) {
    console.error('Failed to create post:', error)
  }
}

// ============================================================================
// Example 2: Type-safe emoji reaction handling
// ============================================================================

class ReactionManager {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async addReaction(postId: string, emoji: EmojiCode): Promise<ReactionResponse> {
    // Type safety ensures only valid emoji codes can be passed
    const request: AddReactionRequest = {
      emoji_code: emoji
    }

    const response = await fetch(`${this.baseUrl}/posts/${postId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json()
      throw new Error(error.error.message)
    }

    return response.json()
  }

  getEmojiDisplay(code: EmojiCode): string {
    return EMOJI_DISPLAY[code]
  }

  getAllValidEmojis(): EmojiCode[] {
    return Object.values(EmojiCode)
  }
}

// Usage example
async function exampleReactionUsage() {
  const reactionManager = new ReactionManager('/api')
  
  try {
    // Type safety prevents invalid emoji codes
    const reaction = await reactionManager.addReaction('post-123', EmojiCode.HEART_EYES)
    console.log(`Added ${reactionManager.getEmojiDisplay(reaction.emoji_code)} reaction`)
  } catch (error) {
    console.error('Failed to add reaction:', error)
  }
}

// ============================================================================
// Example 3: Type-safe notification handling
// ============================================================================

interface NotificationHandler {
  handleNotification(notification: NotificationResponse): void
}

class NotificationProcessor implements NotificationHandler {
  handleNotification(notification: NotificationResponse): void {
    switch (notification.type) {
      case NotificationType.EMOJI_REACTION:
        this.handleReactionNotification(notification)
        break
      case NotificationType.NEW_FOLLOWER:
        this.handleFollowerNotification(notification)
        break
      case NotificationType.MENTION:
        this.handleMentionNotification(notification)
        break
      default:
        console.log('Unknown notification type:', notification.type)
    }
  }

  private handleReactionNotification(notification: NotificationResponse): void {
    if (notification.emoji_code) {
      const emoji = EMOJI_DISPLAY[notification.emoji_code]
      console.log(`Someone reacted with ${emoji} to your post!`)
    }
  }

  private handleFollowerNotification(notification: NotificationResponse): void {
    console.log(`${notification.related_user?.username} started following you!`)
  }

  private handleMentionNotification(notification: NotificationResponse): void {
    console.log(`You were mentioned in a post by ${notification.related_user?.username}`)
  }
}

// ============================================================================
// Example 4: Type-safe validation
// ============================================================================

function validateUserInput(username: string, email: string, postContent: string, postType: PostType) {
  const errors: string[] = []

  // Validate username
  const usernameSchema = createStringSchema(USERNAME_VALIDATION)
  const usernameResult = usernameSchema.validate(username)
  if (!usernameResult.isValid) {
    errors.push(...usernameResult.errors.map(e => e.message))
  }

  // Validate email
  const emailSchema = createStringSchema(EMAIL_VALIDATION)
  const emailResult = emailSchema.validate(email)
  if (!emailResult.isValid) {
    errors.push(...emailResult.errors.map(e => e.message))
  }

  // Validate post content
  const contentSchema = createStringSchema(getPostContentValidation(postType))
  const contentResult = contentSchema.validate(postContent)
  if (!contentResult.isValid) {
    errors.push(...contentResult.errors.map(e => e.message))
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Usage example
function exampleValidation() {
  const validation = validateUserInput(
    'john_doe',
    'john@example.com',
    'This is my gratitude post content',
    PostType.DAILY
  )

  if (!validation.isValid) {
    console.error('Validation errors:', validation.errors)
  } else {
    console.log('All inputs are valid!')
  }
}

// ============================================================================
// Example 5: Type-safe error handling
// ============================================================================

function handleApiError(error: ApiErrorResponse): string {
  switch (error.error.error) {
    case ErrorType.VALIDATION_ERROR:
      return 'Please check your input and try again'
    
    case ErrorType.RATE_LIMIT_EXCEEDED:
      const details = error.error.details as { retry_after: number }
      return `Rate limit exceeded. Try again in ${details.retry_after} seconds`
    
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found'
    
    case ErrorType.UNAUTHORIZED:
      return 'Please log in to continue'
    
    case ErrorType.INVALID_EMOJI_CODE:
      return 'Invalid emoji selected. Please choose a different one'
    
    default:
      return error.error.message || 'An unexpected error occurred'
  }
}

// ============================================================================
// Example 6: Type-safe React component props
// ============================================================================

interface PostCardProps {
  post: PostResponse
  onReaction: (emoji: EmojiCode) => Promise<void>
  onShare: () => Promise<void>
  currentUserReaction?: EmojiCode
}

// This would be a React component using the shared types
function PostCard({ post, onReaction, onShare, currentUserReaction }: PostCardProps) {
  const handleEmojiClick = async (emoji: EmojiCode) => {
    try {
      await onReaction(emoji)
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  return {
    // Component JSX would go here
    postId: post.id,
    content: post.content,
    author: post.author.username,
    reactions: post.reactions_count,
    hearts: post.hearts_count,
    availableEmojis: Object.values(EmojiCode),
    currentReaction: currentUserReaction
  }
}

// ============================================================================
// Example 7: Type-safe service configuration
// ============================================================================

interface ApiServiceConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
}

class ApiService {
  private config: ApiServiceConfig

  constructor(config: ApiServiceConfig) {
    this.config = config
  }

  async request<TRequest, TResponse>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    data?: TRequest
  ): Promise<TResponse> {
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: data ? JSON.stringify(data) : undefined
    })

    if (!response.ok) {
      const error: ApiErrorResponse = await response.json()
      throw new Error(handleApiError(error))
    }

    return response.json()
  }

  // Type-safe API methods
  async createPost(data: CreatePostRequest): Promise<PostResponse> {
    return this.request('/posts', 'POST', data)
  }

  async addReaction(postId: string, data: AddReactionRequest): Promise<ReactionResponse> {
    return this.request(`/posts/${postId}/reactions`, 'POST', data)
  }

  async getNotifications(): Promise<NotificationResponse[]> {
    return this.request('/notifications', 'GET')
  }
}

// Usage example
async function exampleApiService() {
  const api = new ApiService({
    baseUrl: '/api',
    timeout: 5000,
    retryAttempts: 3
  })

  try {
    const post = await api.createPost({
      content: 'Grateful for type safety!',
      post_type: PostType.SPONTANEOUS,
      is_public: true
    })

    await api.addReaction(post.id, {
      emoji_code: EmojiCode.HEART_EYES
    })

    console.log('Post created and reaction added successfully!')
  } catch (error) {
    console.error('API operation failed:', error)
  }
}

// Export examples for testing
export {
  createPost,
  ReactionManager,
  NotificationProcessor,
  validateUserInput,
  handleApiError,
  PostCard,
  ApiService,
  exampleCreatePost,
  exampleReactionUsage,
  exampleValidation,
  exampleApiService
}
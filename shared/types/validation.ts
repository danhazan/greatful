/**
 * Runtime type validation guards and schemas
 */

import { 
  PostType, 
  EmojiCode, 
  NotificationType, 
  ShareMethod, 
  FollowStatus, 
  PrivacyLevel,
  POST_TYPE_LIMITS,
  RATE_LIMITS,
  UserInfo
} from './core'

import {
  PostResponse,
  ReactionResponse,
  NotificationResponse,
  CreatePostRequest,
  AddReactionRequest,
  SignupRequest,
  LoginRequest,
  SessionResponse
} from './api'

// ============================================================================
// Runtime Type Guards
// ============================================================================

/**
 * Type guard for PostType enum
 */
export function isValidPostType(value: string): value is PostType {
  return Object.values(PostType).includes(value as PostType)
}

/**
 * Type guard for EmojiCode enum
 */
export function isValidEmojiCode(value: string): value is EmojiCode {
  return Object.values(EmojiCode).includes(value as EmojiCode)
}

/**
 * Type guard for NotificationType enum
 */
export function isValidNotificationType(value: string): value is NotificationType {
  return Object.values(NotificationType).includes(value as NotificationType)
}

/**
 * Type guard for ShareMethod enum
 */
export function isValidShareMethod(value: string): value is ShareMethod {
  return Object.values(ShareMethod).includes(value as ShareMethod)
}

/**
 * Type guard for FollowStatus enum
 */
export function isValidFollowStatus(value: string): value is FollowStatus {
  return Object.values(FollowStatus).includes(value as FollowStatus)
}

/**
 * Type guard for PrivacyLevel enum
 */
export function isValidPrivacyLevel(value: string): value is PrivacyLevel {
  return Object.values(PrivacyLevel).includes(value as PrivacyLevel)
}

/**
 * Type guard for UserInfo
 */
export function validateUserInfo(data: any): data is UserInfo {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'number' &&
    data.id > 0 &&
    typeof data.username === 'string' &&
    data.username.length >= 3 &&
    data.username.length <= 30 &&
    /^[a-zA-Z0-9_-]+$/.test(data.username) &&
    typeof data.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    (data.bio === undefined || data.bio === null || typeof data.bio === 'string') &&
    (data.profile_image_url === undefined || data.profile_image_url === null || typeof data.profile_image_url === 'string') &&
    typeof data.created_at === 'string'
  )
}

/**
 * Type guard for PostResponse
 */
export function validatePostResponse(data: any): data is PostResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    typeof data.author_id === 'number' &&
    data.author_id > 0 &&
    typeof data.content === 'string' &&
    data.content.length > 0 &&
    isValidPostType(data.post_type) &&
    typeof data.is_public === 'boolean' &&
    typeof data.created_at === 'string' &&
    (data.updated_at === null || data.updated_at === undefined || typeof data.updated_at === 'string') &&
    (data.title === null || data.title === undefined || typeof data.title === 'string') &&
    (data.image_url === null || data.image_url === undefined || typeof data.image_url === 'string') &&
    (data.location === null || data.location === undefined || typeof data.location === 'string') &&
    validateUserInfo(data.author) &&
    typeof data.hearts_count === 'number' &&
    data.hearts_count >= 0 &&
    typeof data.reactions_count === 'number' &&
    data.reactions_count >= 0 &&
    (data.current_user_reaction === null || data.current_user_reaction === undefined || isValidEmojiCode(data.current_user_reaction)) &&
    (data.is_hearted === undefined || typeof data.is_hearted === 'boolean')
  )
}

/**
 * Type guard for ReactionResponse
 */
export function validateReactionResponse(data: any): data is ReactionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    typeof data.user_id === 'number' &&
    data.user_id > 0 &&
    typeof data.post_id === 'string' &&
    data.post_id.length > 0 &&
    isValidEmojiCode(data.emoji_code) &&
    typeof data.emoji_display === 'string' &&
    data.emoji_display.length > 0 &&
    typeof data.created_at === 'string' &&
    validateUserInfo(data.user)
  )
}

/**
 * Type guard for NotificationResponse
 */
export function validateNotificationResponse(data: any): data is NotificationResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    data.id.length > 0 &&
    typeof data.user_id === 'number' &&
    data.user_id > 0 &&
    typeof data.type === 'string' &&
    typeof data.message === 'string' &&
    typeof data.read === 'boolean' &&
    typeof data.created_at === 'string' &&
    (data.post_id === null || data.post_id === undefined || typeof data.post_id === 'string') &&
    (data.related_user_id === null || data.related_user_id === undefined || typeof data.related_user_id === 'number') &&
    (data.emoji_code === null || data.emoji_code === undefined || isValidEmojiCode(data.emoji_code)) &&
    (data.last_updated_at === null || data.last_updated_at === undefined || typeof data.last_updated_at === 'string') &&
    typeof data.is_batch === 'boolean' &&
    typeof data.batch_count === 'number' &&
    data.batch_count >= 1 &&
    (data.parent_id === null || data.parent_id === undefined || typeof data.parent_id === 'string') &&
    (data.related_user === null || data.related_user === undefined || validateUserInfo(data.related_user)) &&
    (data.post === null || data.post === undefined || validatePostResponse(data.post))
  )
}

/**
 * Type guard for CreatePostRequest
 */
export function validateCreatePostRequest(data: any): data is CreatePostRequest {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof data.content !== 'string' ||
    data.content.length === 0 ||
    !isValidPostType(data.post_type)
  ) {
    return false
  }

  // Validate content length based on post type
  const maxLength = POST_TYPE_LIMITS[data.post_type as PostType]
  if (data.content.length > maxLength) {
    return false
  }

  return (
    (data.title === undefined || data.title === null || (typeof data.title === 'string' && data.title.length <= 100)) &&
    (data.image_url === undefined || data.image_url === null || typeof data.image_url === 'string') &&
    (data.location === undefined || data.location === null || (typeof data.location === 'string' && data.location.length <= 100)) &&
    (data.is_public === undefined || typeof data.is_public === 'boolean')
  )
}

/**
 * Type guard for AddReactionRequest
 */
export function validateAddReactionRequest(data: any): data is AddReactionRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    isValidEmojiCode(data.emoji_code)
  )
}

/**
 * Type guard for SignupRequest
 */
export function validateSignupRequest(data: any): data is SignupRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.username === 'string' &&
    data.username.length >= 3 &&
    data.username.length <= 30 &&
    /^[a-zA-Z0-9_-]+$/.test(data.username) &&
    typeof data.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    typeof data.password === 'string' &&
    data.password.length >= 8 &&
    data.password.length <= 128
  )
}

/**
 * Type guard for LoginRequest
 */
export function validateLoginRequest(data: any): data is LoginRequest {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    typeof data.password === 'string' &&
    data.password.length > 0
  )
}

/**
 * Type guard for SessionResponse
 */
export function validateSessionResponse(data: any): data is SessionResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'number' &&
    data.id > 0 &&
    typeof data.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    typeof data.username === 'string' &&
    data.username.length >= 3 &&
    data.username.length <= 30
  )
}

// ============================================================================
// Array Validation Guards
// ============================================================================

/**
 * Type guard for array of PostResponse
 */
export function validatePostResponseArray(data: any): data is PostResponse[] {
  return Array.isArray(data) && data.every(validatePostResponse)
}

/**
 * Type guard for array of ReactionResponse
 */
export function validateReactionResponseArray(data: any): data is ReactionResponse[] {
  return Array.isArray(data) && data.every(validateReactionResponse)
}

/**
 * Type guard for array of NotificationResponse
 */
export function validateNotificationResponseArray(data: any): data is NotificationResponse[] {
  return Array.isArray(data) && data.every(validateNotificationResponse)
}

// ============================================================================
// Validation Schema Interfaces (keeping existing for compatibility)
// ============================================================================

export interface ValidationSchema<T = any> {
  validate(value: T): ValidationResult
  validateAsync?(value: T): Promise<ValidationResult>
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationFieldError[]
  warnings?: ValidationFieldError[]
}

export interface ValidationFieldError {
  field: string
  code: ValidationErrorCode
  message: string
  value?: any
  constraint?: any
}

export enum ValidationErrorCode {
  REQUIRED = 'required',
  MIN_LENGTH = 'min_length',
  MAX_LENGTH = 'max_length',
  INVALID_FORMAT = 'invalid_format',
  INVALID_VALUE = 'invalid_value',
  INVALID_TYPE = 'invalid_type',
  UNIQUE_CONSTRAINT = 'unique_constraint',
  FOREIGN_KEY_CONSTRAINT = 'foreign_key_constraint',
  CUSTOM_VALIDATION = 'custom_validation'
}

// ============================================================================
// Field Validation Rules
// ============================================================================

export interface StringValidationRules {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  allowEmpty?: boolean
  trim?: boolean
  customValidator?: (value: string) => ValidationFieldError | null
}

export interface NumberValidationRules {
  required?: boolean
  min?: number
  max?: number
  integer?: boolean
  positive?: boolean
  customValidator?: (value: number) => ValidationFieldError | null
}

export interface ArrayValidationRules<T = any> {
  required?: boolean
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  itemValidator?: ValidationSchema<T>
  customValidator?: (value: T[]) => ValidationFieldError | null
}

export interface ObjectValidationRules {
  required?: boolean
  properties?: Record<string, ValidationSchema>
  additionalProperties?: boolean
  customValidator?: (value: object) => ValidationFieldError | null
}

// ============================================================================
// Specific Validation Schemas
// ============================================================================

// User validation schemas
export interface UserValidationSchemas {
  username: ValidationSchema<string>
  email: ValidationSchema<string>
  password: ValidationSchema<string>
  bio: ValidationSchema<string>
  profileImageUrl: ValidationSchema<string>
}

// Post validation schemas
export interface PostValidationSchemas {
  content: ValidationSchema<string>
  title: ValidationSchema<string>
  postType: ValidationSchema<PostType>
  imageUrl: ValidationSchema<string>
  location: ValidationSchema<string>
}

// Reaction validation schemas
export interface ReactionValidationSchemas {
  emojiCode: ValidationSchema<EmojiCode>
}

// Notification validation schemas
export interface NotificationValidationSchemas {
  type: ValidationSchema<NotificationType>
  message: ValidationSchema<string>
  data: ValidationSchema<Record<string, any>>
}

// Share validation schemas
export interface ShareValidationSchemas {
  shareMethod: ValidationSchema<ShareMethod>
  messageContent: ValidationSchema<string>
  recipientUserIds: ValidationSchema<number[]>
}

// Follow validation schemas
export interface FollowValidationSchemas {
  status: ValidationSchema<FollowStatus>
}

// User preferences validation schemas
export interface UserPreferenceValidationSchemas {
  privacyLevel: ValidationSchema<PrivacyLevel>
  notificationSettings: ValidationSchema<Record<string, any>>
}

// ============================================================================
// Validation Rule Definitions
// ============================================================================

// Username validation rules
export const USERNAME_VALIDATION: StringValidationRules = {
  required: true,
  minLength: 3,
  maxLength: 30,
  pattern: /^[a-zA-Z0-9_-]+$/,
  trim: true
}

// Email validation rules
export const EMAIL_VALIDATION: StringValidationRules = {
  required: true,
  maxLength: 255,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  trim: true
}

// Password validation rules
export const PASSWORD_VALIDATION: StringValidationRules = {
  required: true,
  minLength: 8,
  maxLength: 128,
  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
}

// Bio validation rules
export const BIO_VALIDATION: StringValidationRules = {
  required: false,
  maxLength: 500,
  trim: true
}

// Post content validation rules (dynamic based on post type)
export const getPostContentValidation = (postType: PostType): StringValidationRules => ({
  required: true,
  minLength: 1,
  maxLength: POST_TYPE_LIMITS[postType],
  trim: true
})

// Post title validation rules
export const POST_TITLE_VALIDATION: StringValidationRules = {
  required: false,
  maxLength: 100,
  trim: true
}

// Share message validation rules
export const SHARE_MESSAGE_VALIDATION: StringValidationRules = {
  required: false,
  maxLength: 200,
  trim: true
}

// Share recipients validation rules
export const SHARE_RECIPIENTS_VALIDATION: ArrayValidationRules<number> = {
  required: false,
  minItems: 1,
  maxItems: RATE_LIMITS.SHARE_RECIPIENTS_MAX,
  uniqueItems: true
}

// URL validation rules
export const URL_VALIDATION: StringValidationRules = {
  required: false,
  pattern: /^https?:\/\/.+/,
  maxLength: 2048
}

// ============================================================================
// Validation Helper Functions
// ============================================================================

export const createValidationError = (
  field: string,
  code: ValidationErrorCode,
  message: string,
  value?: any,
  constraint?: any
): ValidationFieldError => ({
  field,
  code,
  message,
  value,
  constraint
})

export const createValidationResult = (
  errors: ValidationFieldError[] = [],
  warnings: ValidationFieldError[] = []
): ValidationResult => ({
  isValid: errors.length === 0,
  errors,
  warnings
})

// Validation schema factory
export const createStringSchema = (rules: StringValidationRules): ValidationSchema<string> => ({
  validate: (value: string): ValidationResult => {
    const errors: ValidationFieldError[] = []
    
    // Required check
    if (rules.required && (!value || (rules.trim && !value.trim()))) {
      errors.push(createValidationError('value', ValidationErrorCode.REQUIRED, 'Field is required'))
      return createValidationResult(errors)
    }
    
    // Skip other validations if value is empty and not required
    if (!value || (rules.trim && !value.trim())) {
      return createValidationResult(errors)
    }
    
    const processedValue = rules.trim ? value.trim() : value
    
    // Length validations
    if (rules.minLength && processedValue.length < rules.minLength) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.MIN_LENGTH,
        `Minimum length is ${rules.minLength}`,
        processedValue.length,
        rules.minLength
      ))
    }
    
    if (rules.maxLength && processedValue.length > rules.maxLength) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.MAX_LENGTH,
        `Maximum length is ${rules.maxLength}`,
        processedValue.length,
        rules.maxLength
      ))
    }
    
    // Pattern validation
    if (rules.pattern && !rules.pattern.test(processedValue)) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_FORMAT,
        'Invalid format',
        processedValue,
        rules.pattern.source
      ))
    }
    
    // Custom validation
    if (rules.customValidator) {
      const customError = rules.customValidator(processedValue)
      if (customError) {
        errors.push(customError)
      }
    }
    
    return createValidationResult(errors)
  }
})

export const createNumberSchema = (rules: NumberValidationRules): ValidationSchema<number> => ({
  validate: (value: number): ValidationResult => {
    const errors: ValidationFieldError[] = []
    
    // Required check
    if (rules.required && (value === undefined || value === null)) {
      errors.push(createValidationError('value', ValidationErrorCode.REQUIRED, 'Field is required'))
      return createValidationResult(errors)
    }
    
    // Skip other validations if value is not provided and not required
    if (value === undefined || value === null) {
      return createValidationResult(errors)
    }
    
    // Type check
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_TYPE,
        'Value must be a number',
        value
      ))
      return createValidationResult(errors)
    }
    
    // Integer check
    if (rules.integer && !Number.isInteger(value)) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_VALUE,
        'Value must be an integer',
        value
      ))
    }
    
    // Positive check
    if (rules.positive && value <= 0) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_VALUE,
        'Value must be positive',
        value
      ))
    }
    
    // Range validations
    if (rules.min !== undefined && value < rules.min) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_VALUE,
        `Value must be at least ${rules.min}`,
        value,
        rules.min
      ))
    }
    
    if (rules.max !== undefined && value > rules.max) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_VALUE,
        `Value must be at most ${rules.max}`,
        value,
        rules.max
      ))
    }
    
    // Custom validation
    if (rules.customValidator) {
      const customError = rules.customValidator(value)
      if (customError) {
        errors.push(customError)
      }
    }
    
    return createValidationResult(errors)
  }
})

export const createEnumSchema = <T extends string>(
  enumValues: readonly T[],
  required = true
): ValidationSchema<T> => ({
  validate: (value: T): ValidationResult => {
    const errors: ValidationFieldError[] = []
    
    if (required && !value) {
      errors.push(createValidationError('value', ValidationErrorCode.REQUIRED, 'Field is required'))
      return createValidationResult(errors)
    }
    
    if (value && !enumValues.includes(value)) {
      errors.push(createValidationError(
        'value',
        ValidationErrorCode.INVALID_VALUE,
        `Value must be one of: ${enumValues.join(', ')}`,
        value,
        enumValues
      ))
    }
    
    return createValidationResult(errors)
  }
})
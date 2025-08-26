/**
 * Validation schemas and type definitions
 */

import { 
  PostType, 
  EmojiCode, 
  NotificationType, 
  ShareMethod, 
  FollowStatus, 
  PrivacyLevel,
  POST_TYPE_LIMITS,
  RATE_LIMITS
} from './core'

// ============================================================================
// Validation Schema Interfaces
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
/**
 * Error type definitions and hierarchies
 */

// Base error interface
export interface BaseError {
  error: string
  message: string
  details?: Record<string, any>
}

// HTTP error codes
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500
}

// Error types
export enum ErrorType {
  // Authentication errors
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
  UNAUTHORIZED = 'unauthorized',
  
  // Validation errors
  VALIDATION_ERROR = 'validation_error',
  INVALID_INPUT = 'invalid_input',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  
  // Resource errors
  NOT_FOUND = 'not_found',
  ALREADY_EXISTS = 'already_exists',
  PERMISSION_DENIED = 'permission_denied',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  // Business logic errors
  INVALID_EMOJI_CODE = 'invalid_emoji_code',
  CONTENT_TOO_LONG = 'content_too_long',
  INVALID_POST_TYPE = 'invalid_post_type',
  SELF_FOLLOW_FORBIDDEN = 'self_follow_forbidden',
  ALREADY_REACTED = 'already_reacted',
  NO_REACTION_TO_REMOVE = 'no_reaction_to_remove',
  
  // System errors
  DATABASE_ERROR = 'database_error',
  EXTERNAL_SERVICE_ERROR = 'external_service_error',
  INTERNAL_ERROR = 'internal_error'
}

// Validation error details
export interface ValidationErrorDetail {
  field: string
  message: string
  code: string
  value?: any
}

// Validation error response
export interface ValidationError extends BaseError {
  error: ErrorType.VALIDATION_ERROR
  details: {
    fields: ValidationErrorDetail[]
  }
}

// Rate limit error response
export interface RateLimitError extends BaseError {
  error: ErrorType.RATE_LIMIT_EXCEEDED
  details: {
    limit: number
    reset_time: string
    retry_after: number
  }
}

// Not found error response
export interface NotFoundError extends BaseError {
  error: ErrorType.NOT_FOUND
  details: {
    resource: string
    id?: string | number
  }
}

// Permission denied error response
export interface PermissionDeniedError extends BaseError {
  error: ErrorType.PERMISSION_DENIED
  details: {
    resource: string
    action: string
    reason?: string
  }
}

// Business logic error response
export interface BusinessLogicError extends BaseError {
  error: ErrorType
  details: {
    constraint?: string
    current_value?: any
    expected_value?: any
  }
}

// Union type for all possible error responses
export type ApiError = 
  | ValidationError
  | RateLimitError
  | NotFoundError
  | PermissionDeniedError
  | BusinessLogicError
  | BaseError

// Error response wrapper
export interface ErrorResponse {
  success: false
  error: ApiError
  timestamp: string
  request_id?: string
}

// Success response wrapper
export interface SuccessResponse<T = any> {
  success: true
  data: T
  timestamp: string
  request_id?: string
}

// Generic API response
export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse

// Error factory functions
export const createValidationError = (
  fields: ValidationErrorDetail[],
  message = 'Validation failed'
): ValidationError => ({
  error: ErrorType.VALIDATION_ERROR,
  message,
  details: { fields }
})

export const createRateLimitError = (
  limit: number,
  resetTime: string,
  retryAfter: number,
  message = 'Rate limit exceeded'
): RateLimitError => ({
  error: ErrorType.RATE_LIMIT_EXCEEDED,
  message,
  details: {
    limit,
    reset_time: resetTime,
    retry_after: retryAfter
  }
})

export const createNotFoundError = (
  resource: string,
  id?: string | number,
  message = 'Resource not found'
): NotFoundError => ({
  error: ErrorType.NOT_FOUND,
  message,
  details: { resource, ...(id !== undefined && { id }) }
})

export const createPermissionDeniedError = (
  resource: string,
  action: string,
  reason?: string,
  message = 'Permission denied'
): PermissionDeniedError => ({
  error: ErrorType.PERMISSION_DENIED,
  message,
  details: { resource, action, ...(reason !== undefined && { reason }) }
})
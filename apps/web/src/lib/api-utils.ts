/**
 * Shared utilities for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { transformApiResponse } from './caseTransform'

// Centralized API configuration
export const API_CONFIG = {
  BASE_URL: process.env['API_BASE_URL'] || process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000',
  TIMEOUT: 10000, // 10 seconds
} as const

// Standard error response format
export interface ApiErrorResponse {
  error: string
  message?: string
  status?: number
}

// Standard success response format
export interface ApiSuccessResponse<T = any> {
  data?: T
  success?: boolean
  message?: string
}

type ProxyJsonOptions = {
  transform?: boolean
}

/**
 * Standardized error handling for API routes
 */
export function handleApiError(
  error: unknown,
  context: string,
  defaultMessage: string = 'An unexpected error occurred'
): NextResponse<ApiErrorResponse> {
  console.error(`Error in ${context}:`, error)

  // Handle different error types
  if (error instanceof Error) {
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: defaultMessage
    },
    { status: 500 }
  )
}

/**
 * Extract authorization token from request headers
 */
export function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7) // Remove 'Bearer ' prefix
}

/**
 * Create authorization headers for backend requests
 */
export function createAuthHeaders(request: NextRequest): Record<string, string> {
  const token = getAuthToken(request)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return headers
}

/**
 * Check if request has valid authorization
 */
export function hasValidAuth(request: NextRequest): boolean {
  return getAuthToken(request) !== null
}

/**
 * Make authenticated request to backend API
 */
export async function makeBackendRequest(
  endpoint: string,
  options: RequestInit & { authHeaders?: HeadersInit } = {}
): Promise<Response> {
  const { authHeaders, ...fetchOptions } = options

  const url = `${API_CONFIG.BASE_URL}${endpoint}`

  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...fetchOptions.headers,
    },
  }

  return fetch(url, requestOptions)
}

/**
 * Proxy response from backend to frontend
 */
export async function proxyBackendJsonResponse(
  response: Response,
  opts: ProxyJsonOptions = {}
): Promise<NextResponse> {
  const { transform = true } = opts
  const data = await response.json()
  const payload = transform ? transformApiResponse(data) : data
  return NextResponse.json(payload, { status: response.status })
}

/**
 * @deprecated Use proxyBackendJsonResponse(response, { transform }) instead.
 */
export async function proxyBackendResponse(
  response: Response
): Promise<NextResponse> {
  return proxyBackendJsonResponse(response)
}

/**
 * Extract a human-readable error message from backend error payloads.
 */
export function getBackendErrorMessage(
  errorData: any,
  fallback: string
): string {
  if (!errorData || typeof errorData !== 'object') return fallback
  if (typeof errorData.detail === 'string') return errorData.detail
  if (typeof errorData.message === 'string') return errorData.message
  if (typeof errorData.error === 'string') return errorData.error
  return fallback
}

/**
 * Validate required parameters
 */
export function validateRequiredParams(
  params: Record<string, unknown>,
  required: string[]
): string | null {
  for (const param of required) {
    if (!params[param]) {
      return `Missing required parameter: ${param}`
    }
  }
  return null
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data?: T,
  message?: string,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      ...(data !== undefined && { data }),
      success: true,
      ...(message && { message }),
    },
    { status }
  )
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: message,
    },
    { status }
  )
}

/**
 * Get error type from HTTP status code
 */
function getErrorTypeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 409:
      return 'Conflict'
    case 422:
      return 'Validation Error'
    case 500:
      return 'Internal Server Error'
    default:
      return 'Error'
  }
}

import { camelizeKeys, decamelizeKeys } from 'humps'

/**
 * Transform API response from snake_case to camelCase
 * 
 * This utility automatically converts all keys in the response object
 * from Python's snake_case convention to JavaScript's camelCase convention.
 * 
 * @param data - The API response data to transform
 * @returns The transformed data with camelCase keys
 * 
 * @example
 * // Backend returns: { hearts_count: 5, created_at: "2024-01-01" }
 * // Frontend receives: { heartsCount: 5, createdAt: "2024-01-01" }
 * const response = await fetch('/api/posts')
 * const data = await response.json()
 * const transformed = transformApiResponse(data)
 */
export function transformApiResponse<T = any>(data: any): T {
  if (!data) return data
  
  return camelizeKeys(data, (key, convert) => {
    // Apply standard camelCase conversion to all keys
    // If specific keys need to be excluded from transformation in the future,
    // add conditions here. For example:
    // if (key === 'oauth_provider') return key
    return convert(key)
  }) as T
}

/**
 * Transform request data from camelCase to snake_case
 * 
 * This utility automatically converts all keys in the request object
 * from JavaScript's camelCase convention to Python's snake_case convention.
 * 
 * @param data - The request data to transform
 * @returns The transformed data with snake_case keys
 * 
 * @example
 * // Frontend sends: { heartsCount: 5, createdAt: "2024-01-01" }
 * // Backend receives: { hearts_count: 5, created_at: "2024-01-01" }
 * const requestData = { heartsCount: 5, createdAt: "2024-01-01" }
 * const transformed = transformApiRequest(requestData)
 * await fetch('/api/posts', { body: JSON.stringify(transformed) })
 */
export function transformApiRequest<T = any>(data: any): T {
  if (!data) return data
  
  return decamelizeKeys(data) as T
}

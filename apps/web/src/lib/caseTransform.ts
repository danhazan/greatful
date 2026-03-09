import { camelize, decamelizeKeys } from 'humps'

/**
 * CENTRALIZED REGISTRY: Keys whose children should NOT be transformed to camelCase.
 * 
 * IMPORTANT: These keys contain domain-level identifiers (such as emoji codes: 'heart_eyes')
 * rather than schema-level field names. They must preserve their original 
 * snake_case format to correctly match backend storage and frontend mapping 
 * tables (e.g., emojiMapping.ts).
 * 
 * If adding new dynamic dictionaries to the API that use snake_case identifiers,
 * they must be added to this list.
 */
const PROTECTED_KEYS = ['emojiCounts', 'emoji_counts', 'reactionEmojiCodes'];

/**
 * Recursively transforms keys to camelCase, skipping protected branches.
 */
function deepCamelize(obj: any, isProtected = false): any {
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepCamelize(item, isProtected));
  }

  // Handle objects
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      // 1. Determine the key to use. If protected, use as-is.
      const camelKey = isProtected ? key : humpsCamelize(key);

      // 2. Check if this specific key marks the START of a protected branch.
      // Emojis are domain-level identifiers, not schema keys, so they must 
      // bypass camelization to remain compatible with data mappings.
      const normalizedKey = camelKey.toLowerCase();
      const shouldProtect = PROTECTED_KEYS.some(k => k.toLowerCase() === normalizedKey);

      // 3. Transform the value. 
      // If we are already protected, or this key starts a protection, pass true.
      newObj[camelKey] = deepCamelize(obj[key], isProtected || shouldProtect);
    }
    return newObj;
  }

  // Handle primitive values
  // If we are in a protected branch and it's a string, we return it as-is
  // (This handles reactionEmojiCodes array which is string[])
  return obj;
}

// Wrapper to use humps.camelize safely
function humpsCamelize(key: string): string {
  // humps.camelize can handle some edge cases
  return camelize(key);
}

/**
 * Transform API response from snake_case to camelCase
 * 
 * This utility automatically converts all keys in the response object
 * from Python's snake_case convention to JavaScript's camelCase convention,
 * while preserving dynamic keys (like emoji codes) in protected fields.
 * 
 * @param data - The API response data to transform
 * @returns The transformed data with camelCase keys
 */
export function transformApiResponse<T = any>(data: any): T {
  if (!data) return data
  return deepCamelize(data);
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

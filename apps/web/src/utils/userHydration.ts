import { apiClient } from './apiClient'
import { normalizeToUserSearchResult } from './userDataMapping'
import { UserSearchResult } from '@/types/userSearch'

export async function hydrateUserIds(ids: number[]): Promise<UserSearchResult[]> {
  if (ids.length === 0) return []
  try {
    const data = await apiClient.post('/users/batch-profiles', { user_ids: ids }) as any
    const results = data?.data || data || []
    return Array.isArray(results) ? results.map(normalizeToUserSearchResult) : []
  } catch {
    return []
  }
}

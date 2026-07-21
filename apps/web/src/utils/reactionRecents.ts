import { ReactionGroup, VALID_GROUPS } from '@/generated/reactions'
import type { RecentReactionsMap } from '@/hooks/useRecentReactions'

const STORAGE_KEY = 'grateful_reaction_recents'

function emptyMap(): RecentReactionsMap {
  return { heart: [], face: [], hands: [], misc: [] }
}

export function loadRecentReactions(): RecentReactionsMap {
  if (typeof window === 'undefined') return emptyMap()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyMap()
    const parsed = JSON.parse(raw)
    const result = emptyMap()
    VALID_GROUPS.forEach(group => {
      if (Array.isArray(parsed[group])) {
        result[group] = parsed[group].slice(0, 16)
      }
    })
    return result
  } catch {
    return emptyMap()
  }
}

export function saveRecentReactions(map: RecentReactionsMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage errors
  }
}

export function addRecentReactionToMap(
  prev: RecentReactionsMap,
  group: ReactionGroup,
  emojiCode: string
): RecentReactionsMap {
  const currentList = prev[group]
  const filteredList = currentList.filter(c => c !== emojiCode)
  const newList = [emojiCode, ...filteredList].slice(0, 16)
  return { ...prev, [group]: newList }
}

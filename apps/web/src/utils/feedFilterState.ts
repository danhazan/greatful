import { UserSearchResult } from '@/types/userSearch'
import { getUtcRangeFromLocalDates } from '@/utils/dateFilterUtils'
import type { DateFilterPreset } from '@/utils/dateFilterUtils'

export type FeedFilterMode = 'off' | 'boost' | 'required'
export type TypeFilterKey = 'mine' | 'followed' | 'followers' | 'public' | 'images'

export interface TypeFilterOption {
  key: TypeFilterKey
  label: string
  icon: string
}

export const TYPE_FILTERS: TypeFilterOption[] = [
  { key: 'mine', label: 'Mine', icon: 'User' },
  { key: 'followed', label: 'Following', icon: 'Heart' },
  { key: 'followers', label: 'Followers', icon: 'Users' },
  { key: 'public', label: 'Public', icon: 'Globe' },
  { key: 'images', label: 'Images', icon: 'Image' },
]

// Keys in the AND group use type_required (always require).
// Keys in the OR group use type_required_any (match any of).
export const TYPE_FILTER_AND_KEYS: TypeFilterKey[] = ['images']
export const TYPE_FILTER_OR_KEYS: TypeFilterKey[] = ['mine', 'followed', 'followers', 'public']

export interface DateFeedFilters {
  mode: FeedFilterMode
  localRange?: {
    start: string
    end: string
  }
  preset?: DateFilterPreset
}

export interface SearchFeedFilters {
  authors: {
    mode: FeedFilterMode
    users: UserSearchResult[]
  }
  keyword: {
    mode: FeedFilterMode
    text: string
  }
}

export interface AppliedFeedFilters {
  date: DateFeedFilters
  type: Record<TypeFilterKey, FeedFilterMode>
  search: SearchFeedFilters
}

export const DEFAULT_TYPE_FILTERS: Record<TypeFilterKey, FeedFilterMode> = {
  mine: 'off',
  followed: 'off',
  followers: 'off',
  public: 'off',
  images: 'off',
}

export function createEmptyFeedFilters(): AppliedFeedFilters {
  return {
    date: { mode: 'off' },
    type: { ...DEFAULT_TYPE_FILTERS },
    search: {
      authors: { mode: 'off', users: [] },
      keyword: { mode: 'off', text: '' },
    },
  }
}

export function cloneFeedFilters<T>(filters: T): T {
  return JSON.parse(JSON.stringify(filters)) as T
}

export function areFeedFiltersEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isMode(value: string | null): value is Exclude<FeedFilterMode, 'off'> {
  return value === 'boost' || value === 'required'
}

function isTypeFilter(value: string): value is TypeFilterKey {
  return TYPE_FILTERS.some((filter) => filter.key === value)
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function parseFeedFiltersFromSearchParams(params: URLSearchParams): AppliedFeedFilters {
  const filters = createEmptyFeedFilters()

  params.getAll('type_required').forEach((value) => {
    if (isTypeFilter(value)) filters.type[value] = 'required'
  })
  params.getAll('type_required_any').forEach((value) => {
    if (isTypeFilter(value) && filters.type[value] === 'off') filters.type[value] = 'required'
  })
  params.getAll('type_boost').forEach((value) => {
    if (isTypeFilter(value) && filters.type[value] === 'off') filters.type[value] = 'boost'
  })

  const dateMode = params.get('date_mode')
  const dateStart = params.get('date_start')
  const dateEnd = params.get('date_end')
  if (isMode(dateMode) && dateStart && DATE_REGEX.test(dateStart) && dateEnd && DATE_REGEX.test(dateEnd)) {
    filters.date = { mode: dateMode, localRange: { start: dateStart, end: dateEnd } }
  }

  const authorMode = params.get('author_mode')
  const authorIds = Array.from(new Set(
    params.getAll('author_ids')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )).slice(0, 50)
  if (isMode(authorMode) && authorIds.length > 0) {
    filters.search.authors = {
      mode: authorMode,
      users: authorIds.map((id) => ({ id, username: null })),
    }
  }

  const keywordMode = params.get('keyword_mode')
  const keyword = (params.get('keyword') || '').trim()
  if (isMode(keywordMode) && keyword) {
    filters.search.keyword = { mode: keywordMode, text: keyword }
  }

  return filters
}

function setNonDateFilterParams(params: URLSearchParams, filters: AppliedFeedFilters): void {
  TYPE_FILTERS.forEach(({ key }) => {
    if (filters.type[key] === 'required') {
      if (TYPE_FILTER_AND_KEYS.includes(key)) {
        params.append('type_required', key)
      } else if (TYPE_FILTER_OR_KEYS.includes(key)) {
        params.append('type_required_any', key)
      }
    }
    if (filters.type[key] === 'boost') params.append('type_boost', key)
  })

  const authorIds = Array.from(new Set(filters.search.authors.users.map((user) => user.id))).slice(0, 50)
  if (filters.search.authors.mode !== 'off' && authorIds.length > 0) {
    params.set('author_mode', filters.search.authors.mode)
    authorIds.forEach((id) => params.append('author_ids', String(id)))
  }

  const keywordText = filters.search.keyword.text.trim()
  if (filters.search.keyword.mode !== 'off' && keywordText) {
    params.set('keyword_mode', filters.search.keyword.mode)
    params.set('keyword', keywordText)
  }
}

export function serializeFeedFiltersToUrl(filters: AppliedFeedFilters): string {
  const params = new URLSearchParams()
  setNonDateFilterParams(params, filters)
  if (filters.date.mode !== 'off' && filters.date.localRange?.start && filters.date.localRange?.end) {
    params.set('date_mode', filters.date.mode)
    params.set('date_start', filters.date.localRange.start)
    params.set('date_end', filters.date.localRange.end)
  }
  const query = params.toString()
  return query ? `/feed?${query}` : '/feed'
}

export function appendFeedFiltersToApiParams(params: URLSearchParams, filters?: AppliedFeedFilters): void {
  if (!filters) return

  setNonDateFilterParams(params, filters)

  if (filters.date.mode !== 'off' && filters.date.localRange?.start && filters.date.localRange?.end) {
    const utc = getUtcRangeFromLocalDates(filters.date.localRange.start, filters.date.localRange.end)
    params.set('date_mode', filters.date.mode)
    params.set('date_start', utc.startDate)
    params.set('date_end', utc.endDate)
  }
}

// ──────────────────────────────────────────────────
// Feed filter param registry — single source of truth
// for the Next.js API proxy layer. Adding a new
// query param here auto-forwards it to the backend.
// ──────────────────────────────────────────────────

/** Params that can appear multiple times (?key=a&key=b) */
export const FEED_FILTER_MULTI_PARAMS = [
  'type_required',
  'type_required_any',
  'type_boost',
  'author_ids',
] as const

/** Params that appear at most once (?key=value) */
export const FEED_FILTER_SINGLE_PARAMS = [
  'date_mode',
  'date_start',
  'date_end',
  'author_mode',
  'keyword_mode',
  'keyword',
] as const

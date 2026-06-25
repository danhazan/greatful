import {
  AppliedFeedFilters,
  cloneFeedFilters,
  createEmptyFeedFilters,
  parseFeedFiltersFromSearchParams,
  appendFeedFiltersToApiParams,
  serializeFeedFiltersToUrl,
  areFeedFiltersEqual,
} from '../feedFilterState'
import { getUtcRangeFromLocalDates } from '../dateFilterUtils'

function makeParams(urlOrQuery: string): URLSearchParams {
  const qIndex = urlOrQuery.indexOf('?')
  const query = qIndex >= 0 ? urlOrQuery.slice(qIndex + 1) : urlOrQuery
  return new URLSearchParams(query)
}

describe('feedFilterState', () => {
  describe('createEmptyFeedFilters', () => {
    it('returns all-off state', () => {
      const f = createEmptyFeedFilters()
      expect(f.date.mode).toBe('off')
      expect(f.type.mine).toBe('off')
      expect(f.type.followed).toBe('off')
      expect(f.type.followers).toBe('off')
      expect(f.type.public).toBe('off')
      expect(f.type.images).toBe('off')
      expect(f.search.authors.mode).toBe('off')
      expect(f.search.authors.users).toEqual([])
      expect(f.search.keyword.mode).toBe('off')
      expect(f.search.keyword.text).toBe('')
    })
  })

  describe('URL round-trip', () => {
    it('date local range round-trips as YYYY-MM-DD in URL', () => {
      const f = createEmptyFeedFilters()
      f.date = { mode: 'required', localRange: { start: '2026-01-01', end: '2026-02-01' } }
      const url = serializeFeedFiltersToUrl(f)
      expect(url).toContain('date_start=2026-01-01')
      expect(url).toContain('date_end=2026-02-01')
      expect(url).toContain('date_mode=required')
      const parsed = parseFeedFiltersFromSearchParams(makeParams(url))
      expect(parsed.date.mode).toBe('required')
      expect(parsed.date.localRange?.start).toBe('2026-01-01')
      expect(parsed.date.localRange?.end).toBe('2026-02-01')
    })

    it('empty date mode does not serialize range', () => {
      const f = createEmptyFeedFilters()
      const url = serializeFeedFiltersToUrl(f)
      expect(url).toBe('/feed')
    })

    it('type filters', () => {
      const f = createEmptyFeedFilters()
      f.type.mine = 'required'
      f.type.images = 'boost'
      const url = serializeFeedFiltersToUrl(f)
      const parsed = parseFeedFiltersFromSearchParams(makeParams(url))
      expect(parsed.type.mine).toBe('required')
      expect(parsed.type.images).toBe('boost')
      expect(parsed.type.followed).toBe('off')
    })

    it('author filters', () => {
      const f = createEmptyFeedFilters()
      f.search.authors = {
        mode: 'required',
        users: [{ id: 12, username: null }, { id: 44, username: 'bob' }],
      }
      const url = serializeFeedFiltersToUrl(f)
      const parsed = parseFeedFiltersFromSearchParams(makeParams(url))
      expect(parsed.search.authors.mode).toBe('required')
      const ids = parsed.search.authors.users.map(u => u.id).sort()
      expect(ids).toEqual([12, 44])
    })

    it('keyword filter', () => {
      const f = createEmptyFeedFilters()
      f.search.keyword = { mode: 'boost', text: 'gratitude' }
      const url = serializeFeedFiltersToUrl(f)
      const parsed = parseFeedFiltersFromSearchParams(makeParams(url))
      expect(parsed.search.keyword.mode).toBe('boost')
      expect(parsed.search.keyword.text).toBe('gratitude')
    })

    it('mixed boost/required modes', () => {
      const f: AppliedFeedFilters = {
        date: { mode: 'required', localRange: { start: '2026-01-01', end: '2026-02-01' } },
        type: { mine: 'boost', followed: 'off', followers: 'off', public: 'off', images: 'required' },
        search: {
          authors: { mode: 'boost', users: [{ id: 7, username: 'alice' }] },
          keyword: { mode: 'off', text: '' },
        },
      }
      const url = serializeFeedFiltersToUrl(f)
      const parsed = parseFeedFiltersFromSearchParams(makeParams(url))
      expect(parsed.date.mode).toBe('required')
      expect(parsed.date.localRange?.start).toBe('2026-01-01')
      expect(parsed.date.localRange?.end).toBe('2026-02-01')
      expect(parsed.type.mine).toBe('boost')
      expect(parsed.type.images).toBe('required')
      expect(parsed.search.authors.mode).toBe('boost')
      expect(parsed.search.authors.users.map(u => u.id)).toEqual([7])
    })

    it('ignores non-YYYY-MM-DD date values', () => {
      const params = makeParams('date_mode=required&date_start=2026-01-01T00:00:00Z&date_end=2026-02-01T00:00:00Z')
      const parsed = parseFeedFiltersFromSearchParams(params)
      expect(parsed.date.mode).toBe('off')
    })
  })

  describe('areFeedFiltersEqual', () => {
    it('detects equal filters', () => {
      const a = createEmptyFeedFilters()
      const b = cloneFeedFilters(a)
      expect(areFeedFiltersEqual(a, b)).toBe(true)
    })

    it('detects differing filters', () => {
      const a = createEmptyFeedFilters()
      const b = createEmptyFeedFilters()
      b.type.mine = 'required'
      expect(areFeedFiltersEqual(a, b)).toBe(false)
    })
  })

  describe('appendFeedFiltersToApiParams', () => {
    it('appends nothing for empty filters', () => {
      const params = new URLSearchParams()
      appendFeedFiltersToApiParams(params, undefined)
      expect(params.toString()).toBe('')
    })

    it('appends nothing for all-off filters', () => {
      const params = new URLSearchParams()
      appendFeedFiltersToApiParams(params, createEmptyFeedFilters())
      expect(params.toString()).toBe('')
    })

    it('converts local dates to UTC ISO timestamps', () => {
      const f = createEmptyFeedFilters()
      f.date = { mode: 'required', localRange: { start: '2026-01-01', end: '2026-02-01' } }
      const params = new URLSearchParams()
      appendFeedFiltersToApiParams(params, f)
      const expected = getUtcRangeFromLocalDates('2026-01-01', '2026-02-01')
      expect(params.get('date_mode')).toBe('required')
      expect(params.get('date_start')).toBe(expected.startDate)
      expect(params.get('date_end')).toBe(expected.endDate)
    })
  })
})

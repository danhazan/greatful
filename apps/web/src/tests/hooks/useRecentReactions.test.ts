import { renderHook, act } from '@testing-library/react'
import { useRecentReactions } from '@/hooks/useRecentReactions'

const STORAGE_KEY = 'grateful_reaction_recents'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

function flushEffect(): Promise<void> {
  return act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

describe('useRecentReactions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('loads from localStorage on mount', () => {
    const existing = {
      heart: ['heart', 'sparkling_heart'],
      face: [], hands: [], nature: [], animals: [], food: [], misc: []
    }
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existing))

    const { result } = renderHook(() => useRecentReactions())
    expect(result.current.recentReactions.heart).toEqual(['heart', 'sparkling_heart'])
  })

  it('starts empty when nothing stored', () => {
    const { result } = renderHook(() => useRecentReactions())
    expect(result.current.recentReactions).toEqual({
      heart: [], face: [], hands: [], nature: [], animals: [], food: [], misc: []
    })
  })

  it('adds recent reaction and persists to localStorage', async () => {
    const { result } = renderHook(() => useRecentReactions())

    await act(async () => {
      result.current.addRecentReaction('heart', 'heart_eyes')
    })

    expect(result.current.recentReactions.heart).toEqual(['heart_eyes'])

    // Verify persisted
    const stored = JSON.parse(localStorageMock.setItem.mock.calls.slice(-1)[0][1])
    expect(stored.heart).toEqual(['heart_eyes'])
  })

  it('moves existing reaction to front (dedup + reorder)', async () => {
    const existing = {
      heart: ['sparkling_heart', 'heart', 'blue_heart'],
      face: [], hands: [], nature: [], animals: [], food: [], misc: []
    }
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existing))

    const { result } = renderHook(() => useRecentReactions())

    await act(async () => {
      result.current.addRecentReaction('heart', 'heart')
    })

    expect(result.current.recentReactions.heart).toEqual(['heart', 'sparkling_heart', 'blue_heart'])
  })

  it('limits to 16 reactions per group', async () => {
    const { result } = renderHook(() => useRecentReactions())

    for (let i = 0; i < 20; i++) {
      await act(async () => {
        result.current.addRecentReaction('face', `face_${i}`)
      })
    }

    expect(result.current.recentReactions.face.length).toBe(16)
    expect(result.current.recentReactions.face[0]).toBe('face_19')
  })

  it('survives remount (simulating page refresh)', () => {
    const existing = {
      heart: ['heart', 'sparkling_heart'],
      face: ['blush'],
      hands: [], nature: [], animals: [], food: [], misc: []
    }
    localStorageMock.setItem(STORAGE_KEY, JSON.stringify(existing))

    // First mount
    const { result: r1, unmount } = renderHook(() => useRecentReactions())
    expect(r1.current.recentReactions.heart).toEqual(['heart', 'sparkling_heart'])
    unmount()

    // Second mount (simulates page refresh)
    const { result: r2 } = renderHook(() => useRecentReactions())
    expect(r2.current.recentReactions.heart).toEqual(['heart', 'sparkling_heart'])
    expect(r2.current.recentReactions.face).toEqual(['blush'])
  })

  it('is never loading (synchronous init)', () => {
    const { result } = renderHook(() => useRecentReactions())
    expect(result.current.isLoading).toBe(false)
  })
})

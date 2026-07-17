// IMPORTANT: Do NOT import jest from @jest/globals. Use global jest instead.
// jest.mock factory runs BEFORE imports are initialized, so locally imported
// jest would be in Temporal Dead Zone, causing the factory to throw silently
// and the mock to not be applied.

const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/auth/login',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: jest.fn(),
}))

import { describe, it, expect, beforeEach } from '@jest/globals'
import { renderHook } from '@testing-library/react'
import { useUser } from '@/contexts/UserContext'
import { useRedirectIfAuthenticated } from '../useAuthRedirect'

const useUserMock = useUser as jest.Mock

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    useUserMock.mockReset()
  })

  it('returns isRedirecting=true when authenticated', () => {
    useUserMock.mockReturnValue({ currentUser: { id: '1' }, isLoading: false })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.isRedirecting).toBe(true)
  })

  it('returns isRedirecting=false when user is null', () => {
    useUserMock.mockReturnValue({ currentUser: null, isLoading: false })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.isRedirecting).toBe(false)
  })

  it('returns isRedirecting=false while loading', () => {
    useUserMock.mockReturnValue({ currentUser: null, isLoading: true })

    const { result } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.isRedirecting).toBe(false)
  })

  it('stays isRedirecting=true when authenticated after re-render', () => {
    useUserMock.mockReturnValue({ currentUser: { id: '1' }, isLoading: false })

    const { result, rerender } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.isRedirecting).toBe(true)
    rerender()
    expect(result.current.isRedirecting).toBe(true)
  })

  it('transitions isRedirecting from false to true when auth state changes', () => {
    useUserMock.mockReturnValue({ currentUser: null, isLoading: true })

    const { result, rerender } = renderHook(() => useRedirectIfAuthenticated())

    expect(result.current.isRedirecting).toBe(false)

    useUserMock.mockReturnValue({ currentUser: { id: '1' }, isLoading: false })
    rerender()

    expect(result.current.isRedirecting).toBe(true)
  })

  it('calls router.replace exactly once on the authenticated-loading transition', () => {
    useUserMock.mockReturnValue({ currentUser: null, isLoading: true })

    const { rerender } = renderHook(() => useRedirectIfAuthenticated())

    expect(mockReplace).not.toHaveBeenCalled()

    useUserMock.mockReturnValue({ currentUser: { id: '1' }, isLoading: false })
    rerender()

    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/feed')
  })
})

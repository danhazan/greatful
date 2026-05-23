/**
 * Centralized next/navigation mock for tests.
 *
 * Why: Per-file jest.mock('next/navigation', ...) blocks proliferated across
 * 9+ test files. This single source of truth eliminates duplication and
 * ensures usePathname / useSearchParams are available everywhere — which is
 * required by useAuthRedirect and any component reading current route state.
 *
 * Exports:
 *   mockNavigation   — default mock object (drop-in for jest.mock factory)
 *   createMockRouter — factory for custom router instances with typed overrides
 *   resetMockNavigation — reset all mock state (calls + return values)
 */
import { jest } from '@jest/globals'

export interface MockRouter {
  push: jest.Mock
  replace: jest.Mock
  back: jest.Mock
  forward: jest.Mock
  refresh: jest.Mock
  prefetch: jest.Mock
}

export function createMockRouter(overrides: Partial<MockRouter> = {}): MockRouter {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    ...overrides,
  }
}

export interface MockNavigation {
  useRouter: jest.Mock<() => MockRouter>
  usePathname: jest.Mock<() => string>
  useSearchParams: jest.Mock<() => URLSearchParams>
}

export const mockNavigation: MockNavigation = {
  useRouter: jest.fn(() => createMockRouter()),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}

export function resetMockNavigation() {
  mockNavigation.useRouter.mockReset()
  mockNavigation.useRouter.mockImplementation(() => createMockRouter())
  mockNavigation.usePathname.mockReset()
  mockNavigation.usePathname.mockImplementation(() => '/')
  mockNavigation.useSearchParams.mockReset()
  mockNavigation.useSearchParams.mockImplementation(() => new URLSearchParams())
}

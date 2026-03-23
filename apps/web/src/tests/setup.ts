import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env['NEXT_PUBLIC_API_URL'] = 'http://localhost:8000'

import React from 'react'

// Mock Next.js Link
jest.mock('next/link', () => {
  const React = require('react')
  return React.forwardRef(function MockLink(
    { children, href, prefetch, replace, scroll, shallow, passHref, ...props }: any,
    ref: any
  ) {
    return React.createElement('a', { ref, href: href?.toString() || href, ...props }, children)
  })
})

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

// Only define localStorage if window exists (jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })
}

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Mock URL.createObjectURL and revokeObjectURL
if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url') as any
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn() as any
  }
}
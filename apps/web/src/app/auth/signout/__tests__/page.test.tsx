import React from 'react'
import { render, screen } from '@testing-library/react'
import SignOutPage from '@/app/auth/signout/page'

const mockRouter = { replace: jest.fn(), push: jest.fn() }
const mockLogout = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/contexts/UserContext', () => ({
  useUser: () => ({ logout: mockLogout }),
}))

describe('/auth/signout', () => {
  beforeEach(() => {
    mockRouter.replace.mockClear()
    mockRouter.push.mockClear()
    mockLogout.mockClear()
  })

  it('reuses the existing logout implementation exactly once', () => {
    render(<SignOutPage />)
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('navigates to the public login page after clearing the session', () => {
    render(<SignOutPage />)
    expect(mockRouter.replace).toHaveBeenCalledWith('/auth/login')
    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
  })

  it('does not navigate to an authenticated-only page', () => {
    render(<SignOutPage />)
    const target = mockRouter.replace.mock.calls[0][0]
    expect(target).not.toBe('/feed')
    expect(target).toBe('/auth/login')
  })

  it('renders the signed-out state after clearing', () => {
    render(<SignOutPage />)
    expect(screen.getByText('Signed out')).toBeInTheDocument()
    expect(screen.getByText('Your Social session has been cleared.')).toBeInTheDocument()
  })
})
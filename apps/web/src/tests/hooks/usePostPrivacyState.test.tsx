import React from 'react'
import { render, act } from '@testing-library/react'
import { usePostPrivacyState } from '@/hooks/usePostPrivacyState'
import { PostPrivacy } from '@/types/post'

describe('usePostPrivacyState', () => {
  it('defaults payload privacy_level to public when undefined', () => {
    let latest: ReturnType<typeof usePostPrivacyState> | null = null

    const Harness = ({ initial }: { initial: PostPrivacy }) => {
      const state = usePostPrivacyState(initial)
      latest = state
      return null
    }

    render(<Harness initial={{ privacyRules: [], specificUsers: [] }} />)

    expect(latest?.buildPayload().privacy_level).toBe('public')
  })

  it('adds and removes specific_users rule when users change', () => {
    let latest: ReturnType<typeof usePostPrivacyState> | null = null

    const Harness = ({ initial }: { initial: PostPrivacy }) => {
      const state = usePostPrivacyState(initial)
      latest = state
      return null
    }

    render(<Harness initial={{ privacyLevel: 'custom', privacyRules: [], specificUsers: [] }} />)

    act(() => {
      latest?.setSpecificUsers([42])
    })

    expect(latest?.privacyRules).toContain('specific_users')

    act(() => {
      latest?.setSpecificUsers([])
    })

    expect(latest?.privacyRules).not.toContain('specific_users')
  })
})

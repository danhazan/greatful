import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { describe, expect, it } from '@jest/globals'
import PostPrivacyBadge from '@/components/PostPrivacyBadge'

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    getBatchUserProfiles: jest.fn().mockResolvedValue([]),
  },
}))

describe('PostPrivacyBadge', () => {
  it('renders custom icon for all custom rule combinations', () => {
    const { rerender } = render(
      <PostPrivacyBadge privacyLevel="custom" privacyRules={['followers']} specificUsersCount={0} />
    )
    expect(screen.getByTestId('privacy-icon-custom')).toBeInTheDocument()

    rerender(
      <PostPrivacyBadge privacyLevel="custom" privacyRules={['following', 'specific_users']} specificUsersCount={2} />
    )
    expect(screen.getByTestId('privacy-icon-custom')).toBeInTheDocument()
  })

  it('adds title and aria-label in icon-only mode', () => {
    render(
      <PostPrivacyBadge
        privacyLevel="custom"
        privacyRules={['followers', 'specific_users']}
        specificUsersCount={2}
        showLabel={false}
      />
    )

    const badge = screen.getByLabelText('Followers and 2 Users')
    expect(badge).toHaveAttribute('title', 'Followers + 2 Users')
  })

  it('fetches batch profiles once per preview open and keeps badge layout stable', async () => {
    const { apiClient } = await import('@/utils/apiClient')
    jest.useFakeTimers()

    render(
      <PostPrivacyBadge
        privacyLevel="custom"
        privacyRules={['specific_users']}
        specificUsers={[1, 2]}
        isAuthor
        postPrivacy={{ privacyLevel: 'custom', privacyRules: ['specific_users'], specificUsers: [1, 2] }}
        showQuickPreview
      />
    )

    const badge = screen.getByLabelText('2 Users')
    const initialClassName = badge.className

    fireEvent.mouseEnter(badge)
    jest.advanceTimersByTime(200)
    expect(apiClient.getBatchUserProfiles).toHaveBeenCalledTimes(1)

    fireEvent.click(badge)
    expect(apiClient.getBatchUserProfiles).toHaveBeenCalledTimes(1)
    expect(badge.className).toBe(initialClassName)

    jest.useRealTimers()
  })
})

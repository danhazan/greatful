import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { describe, expect, it } from '@jest/globals'
import PostPrivacyBadge from '@/components/PostPrivacyBadge'

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    getUserProfile: jest.fn().mockResolvedValue({}),
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
})
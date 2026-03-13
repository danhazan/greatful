import { render, screen, fireEvent } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import { describe, expect, it } from '@jest/globals'
import PostVisibilityPreview from '@/components/PostVisibilityPreview'

const basePrivacy = {
  privacyRules: [],
  specificUsers: [],
}

describe('PostVisibilityPreview', () => {
  it('renders public visibility message', () => {
    render(
      <PostVisibilityPreview
        postPrivacy={{ ...basePrivacy, privacyLevel: 'public' }}
      />
    )
    expect(screen.getByText('Everyone can see this post')).toBeInTheDocument()
  })

  it('renders private visibility message', () => {
    render(
      <PostVisibilityPreview
        postPrivacy={{ ...basePrivacy, privacyLevel: 'private' }}
      />
    )
    expect(screen.getByText('Only you can see this post')).toBeInTheDocument()
  })

  it('renders custom rules and users', () => {
    render(
      <PostVisibilityPreview
        postPrivacy={{
          privacyLevel: 'custom',
          privacyRules: ['followers', 'following', 'specific_users'],
          specificUsers: [1, 2],
        }}
        specificUsers={[
          { id: 1, username: 'john', displayName: 'John Smith' },
          { id: 2, username: 'alice', displayName: 'Alice Chen' },
        ]}
      />
    )

    expect(screen.getByText('Visible to:')).toBeInTheDocument()
    expect(screen.getByText('Your followers')).toBeInTheDocument()
    expect(screen.getByText('People you follow')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
    expect(screen.getByText('Alice Chen')).toBeInTheDocument()
  })

  it('shows +X more and expands the user list', () => {
    const users = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      username: `user${index + 1}`,
      displayName: `User ${index + 1}`,
    }))

    render(
      <PostVisibilityPreview
        postPrivacy={{
          privacyLevel: 'custom',
          privacyRules: ['specific_users'],
          specificUsers: users.map((user) => user.id),
        }}
        specificUsers={users}
      />
    )

    expect(screen.getByText('+ 2 more')).toBeInTheDocument()
    const expandButton = screen.getByRole('button', { name: 'Show all users' })
    fireEvent.click(expandButton)
    expect(screen.queryByText('+ 2 more')).not.toBeInTheDocument()
    expect(screen.getByText('User 12')).toBeInTheDocument()
  })
})

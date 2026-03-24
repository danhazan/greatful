import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PostPrivacySelector from '@/components/PostPrivacySelector'

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    getUserProfile: jest.fn().mockResolvedValue({}),
  },
}))

describe('PostPrivacySelector', () => {
  it('preserves unresolved specific user IDs as placeholders', async () => {
    render(
      <PostPrivacySelector
        privacyLevel="custom"
        privacyRules={['specific_users']}
        specificUsers={[{ id: 42, username: 'user42' }]}
        onPrivacyLevelChange={() => {}}
        onPrivacyRulesChange={() => {}}
        onSpecificUsersChange={() => {}}
      />
    )

    const privacyButton = screen.getByRole('button')
    fireEvent.click(privacyButton)

    const customOption = screen.getByText('Custom')
    fireEvent.click(customOption)

    await waitFor(() => {
      expect(screen.getByText('@user42')).toBeInTheDocument()
    })
  })
})

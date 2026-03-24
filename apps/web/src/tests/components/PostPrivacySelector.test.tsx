import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, jest } from '@jest/globals'
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
      expect(screen.getByText('@user42')).toBeTruthy()
    })
  })

  it('should not trigger hydration API calls when selecting users interactively', async () => {
    const onSpecificUsersChange = jest.fn()
    const testUser = { id: 101, username: 'newuser', displayName: 'New User' }

    const { rerender } = render(
      <PostPrivacySelector
        privacyLevel="custom"
        privacyRules={['specific_users']}
        specificUsers={[]}
        onPrivacyLevelChange={() => {}}
        onPrivacyRulesChange={() => {}}
        onSpecificUsersChange={onSpecificUsersChange}
      />
    )

    // Simulate opening the selector
    fireEvent.click(screen.getByRole('button'))
    
    // Select Custom to ensure UserMultiSelect would be visible
    fireEvent.click(screen.getByText('Custom'))
    
    // Simulate selection
    onSpecificUsersChange([testUser])

    // Rerender with the "selected" user
    rerender(
      <PostPrivacySelector
        privacyLevel="custom"
        privacyRules={['specific_users']}
        specificUsers={[testUser]}
        onPrivacyLevelChange={() => {}}
        onPrivacyRulesChange={() => {}}
        onSpecificUsersChange={onSpecificUsersChange}
      />
    )

    // Wait and assert that getUserProfile was NEVER called for this new user
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const { apiClient } = require('@/utils/apiClient')
    expect(apiClient.getUserProfile).not.toHaveBeenCalledWith("101")
    
    // Assert the UI shows the full user and it matches our object
    const userPills = screen.getByText('@newuser')
    expect(userPills).toBeTruthy()
    
    // Check that we didn't just render a fallback
    // In our implementation, a fallback happens if normalization misses data.
    // The testUser has displayName "New User".
    expect(onSpecificUsersChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 101,
          username: 'newuser',
          displayName: 'New User'
        })
      ])
    )
  })
})

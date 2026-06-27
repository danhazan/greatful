import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import EditPostModal from '@/components/EditPostModal'

const mockHydrateUserIds = jest.fn()

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showLoading: jest.fn(() => 'toast-id'),
    hideToast: jest.fn(),
  }),
}))

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    getUserProfile: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/utils/userHydration', () => ({
  hydrateUserIds: (...args: any[]) => mockHydrateUserIds(...args),
}))

jest.mock('@/components/RichTextEditor', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: (() => {
      const MockRichTextEditor = React.forwardRef((props: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          getPlainText: () => props.value || '',
          focus: jest.fn(),
          clear: jest.fn(),
        }))
        return (
          <textarea
            data-testid="rich-text-editor"
            value={props.value || ''}
            onChange={(event) => props.onChange?.(event.target.value, event.target.value)}
          />
        )
      })
      MockRichTextEditor.displayName = 'MockRichTextEditor'
      return MockRichTextEditor
    })(),
  }
})

describe('EditPostModal privacy payload', () => {
  beforeEach(() => {
    mockHydrateUserIds.mockReset()
  })

  it('submits privacy fields with the edit payload', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    mockHydrateUserIds.mockResolvedValue([])

    render(
      <EditPostModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        post={{
          id: 'post-1',
          content: 'Hello world',
          privacyLevel: 'private',
          privacyRules: [],
          specificUsers: [],
        }}
      />
    )

    const submitButton = screen.getByRole('button', { name: /update post/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    expect(onSubmit).toHaveBeenCalled()
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.privacyLevel).toBe('private')
    expect(payload.privacyRules).toEqual([])
    expect(payload.specificUsers).toEqual([])
  })

  it('preloads selected users from post.specificUsers and submits them', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    mockHydrateUserIds.mockResolvedValue([
      { id: 42, username: 'user42', displayName: 'User 42', profileImageUrl: null },
      { id: 99, username: 'user99', displayName: 'User 99', profileImageUrl: null },
    ])

    render(
      <EditPostModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        post={{
          id: 'post-1',
          content: 'Custom post',
          privacyLevel: 'custom',
          privacyRules: ['specific_users'],
          specificUsers: [42, 99],
        }}
      />
    )

    // Wait for hydration to complete
    await waitFor(() => {
      expect(mockHydrateUserIds).toHaveBeenCalledWith([42, 99])
    })

    const submitButton = screen.getByRole('button', { name: /update post/i })
    await act(async () => {
      fireEvent.click(submitButton)
    })

    expect(onSubmit).toHaveBeenCalled()
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.privacyLevel).toBe('custom')
    expect(payload.privacyRules).toContain('specific_users')
    expect(payload.specificUsers).toEqual([42, 99])
  })
})

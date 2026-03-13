import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import EditPostModal from '@/components/EditPostModal'

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
    getBatchUserProfiles: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('@/components/RichTextEditor', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
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
    }),
  }
})

describe('EditPostModal privacy payload', () => {
  it('submits privacy fields with the edit payload', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    const onClose = jest.fn()

    render(
      <EditPostModal
        isOpen
        onClose={onClose}
        onSubmit={onSubmit}
        post={{
          id: 'post-1',
          content: 'Hello world',
          postType: 'daily',
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
    expect(payload.privacy_level).toBe('private')
    expect(payload.rules).toEqual([])
    expect(payload.specific_users).toEqual([])
  })
})

const mockGetImageUrl = jest.fn((url) => url)
const mockPrepareImageForUpload = jest.fn()
const mockShowDebugSuccess = jest.fn()
const mockShowError = jest.fn()
const mockDelete = jest.fn()

jest.mock('@/utils/imageUtils', () => ({
  getImageUrl: (...args: any[]) => mockGetImageUrl(...args),
}))

jest.mock('@/utils/imageUpload', () => ({
  prepareImageForUpload: (...args: any[]) => mockPrepareImageForUpload(...args),
}))

jest.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showDebugSuccess: mockShowDebugSuccess, showError: mockShowError }),
}))

jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    delete: (...args: any[]) => mockDelete(...args),
    requestRaw: jest.fn(),
  },
}))

jest.mock('lucide-react', () => ({
  Camera: () => null,
  Upload: () => null,
  X: () => null,
  User: () => <div data-testid="user-icon" />,
  Trash2: () => null,
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProfilePhotoUpload from '@/components/ProfilePhotoUpload'

beforeEach(() => {
  jest.clearAllMocks()
})

describe('controlled mode (welcome page)', () => {
  it('shows photo when currentPhotoUrl is provided', () => {
    render(
      <ProfilePhotoUpload
        currentPhotoUrl="https://oauth.example.com/photo.jpg"
        onPhotoUpdate={jest.fn()}
        onControlledFile={jest.fn()}
      />
    )
    expect(screen.getByAltText('Profile')).toBeTruthy()
  })

  it('removes photo display on Remove click even though currentPhotoUrl persists', () => {
    const onPhotoUpdate = jest.fn()
    render(
      <ProfilePhotoUpload
        currentPhotoUrl="https://oauth.example.com/photo.jpg"
        onPhotoUpdate={onPhotoUpdate}
        onControlledFile={jest.fn()}
      />
    )
    expect(screen.getByAltText('Profile')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Remove photo'))

    expect(onPhotoUpdate).toHaveBeenCalledWith(null)
    expect(screen.queryByAltText('Profile')).toBeNull()
    expect(screen.getByTestId('user-icon')).toBeTruthy()
  })

  it('notifies parent when Remove clicked with only previewUrl (no currentPhotoUrl)', () => {
    const onPhotoUpdate = jest.fn()
    const { rerender } = render(
      <ProfilePhotoUpload
        previewUrl="blob:mock-preview-url"
        onPhotoUpdate={onPhotoUpdate}
        onControlledFile={jest.fn()}
      />
    )
    expect(screen.getByAltText('Profile')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Remove photo'))

    expect(onPhotoUpdate).toHaveBeenCalledWith(null)
    // Once parent clears previewUrl prop, component shows placeholder
    rerender(
      <ProfilePhotoUpload
        onPhotoUpdate={onPhotoUpdate}
        onControlledFile={jest.fn()}
      />
    )
    expect(screen.queryByAltText('Profile')).toBeNull()
  })
})

describe('non-controlled mode (profile page)', () => {
  it('calls DELETE API and notifies parent on Remove', async () => {
    mockDelete.mockResolvedValue({ ok: true })
    const onPhotoUpdate = jest.fn()
    render(
      <ProfilePhotoUpload
        currentPhotoUrl="https://example.com/photo.jpg"
        onPhotoUpdate={onPhotoUpdate}
      />
    )
    expect(screen.getByAltText('Profile')).toBeTruthy()

    fireEvent.click(screen.getByTitle('Remove photo'))

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/users/me/profile/photo')
    })
    expect(onPhotoUpdate).toHaveBeenCalledWith(null)
  })
})

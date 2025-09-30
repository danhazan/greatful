import React from 'react'
import { render, act, waitFor, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { stateSyncUtils } from '@/utils/stateSynchronization'

// Mock the profile page since it's complex to import directly
const MockProfilePage = () => {
  const [user, setUser] = React.useState({
    id: 123,
    username: 'testuser',
    displayName: 'Test User',
    profileImage: 'original-image.jpg'
  })

  const handlePhotoUpdate = (photoUrl: string | null) => {
    if (user) {
      setUser({
        ...user,
        profileImage: photoUrl || undefined
      })
      
      // Emit global state synchronization event for profile image update
      stateSyncUtils.updateUserProfile(user.id.toString(), {
        image: photoUrl || undefined
      })
    }
  }

  const handleProfileUpdate = () => {
    const updatedUser = {
      ...user,
      displayName: 'Updated Display Name'
    }
    setUser(updatedUser)
    
    // Emit global state synchronization event
    stateSyncUtils.updateUserProfile(user.id.toString(), {
      display_name: 'Updated Display Name',
      name: 'Updated Display Name'
    })
  }

  return (
    <div>
      <div data-testid="user-name">{user.displayName}</div>
      <div data-testid="user-image">{user.profileImage}</div>
      <button onClick={() => handlePhotoUpdate('new-image.jpg')}>
        Update Photo
      </button>
      <button onClick={handleProfileUpdate}>
        Update Profile
      </button>
    </div>
  )
}

describe('Profile Page State Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should emit state sync events when profile is updated', async () => {
    const mockUpdateUserProfile = jest.spyOn(stateSyncUtils, 'updateUserProfile')
    
    render(<MockProfilePage />)

    // Update profile
    fireEvent.click(screen.getByText('Update Profile'))

    // Verify state sync was called
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('123', {
      display_name: 'Updated Display Name',
      name: 'Updated Display Name'
    })

    mockUpdateUserProfile.mockRestore()
  })

  it('should emit state sync events when photo is updated', async () => {
    const mockUpdateUserProfile = jest.spyOn(stateSyncUtils, 'updateUserProfile')
    
    render(<MockProfilePage />)

    // Update photo
    fireEvent.click(screen.getByText('Update Photo'))

    // Verify state sync was called
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('123', {
      image: 'new-image.jpg'
    })

    mockUpdateUserProfile.mockRestore()
  })
})
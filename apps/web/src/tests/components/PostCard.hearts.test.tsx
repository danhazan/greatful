import React from 'react'
import { render, screen, fireEvent, waitFor, act, within } from '@/tests/utils/testUtils'
import '@testing-library/jest-dom'
import PostCard from '../../components/PostCard'

const mockPost = {
  id: 'test-post-1',
  content: 'Test post content',
  author: {
    id: '1',
    name: 'testuser',
    image: undefined,
  },
  createdAt: '2024-01-15T12:00:00Z',
  postType: 'text' as const,
  heartsCount: 3,
  isHearted: false,
  reactionsCount: 0,
  currentUserReaction: undefined,
}

import { getAccessToken, isAuthenticated } from '@/utils/auth';
import { apiClient } from '@/utils/apiClient';

describe('PostCard Hearts Counter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAccessToken as jest.Mock).mockReturnValue('fake-token');
    (isAuthenticated as jest.Mock).mockReturnValue(true);
  })

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should open hearts viewer when hearts counter is clicked', async () => {
    const heartsData = [
      { id: 'heart-1', userId: '1', userName: 'user1', userImage: null, createdAt: '2024-01-15T12:00:00Z' },
      { id: 'heart-2', userId: '2', userName: 'user2', userImage: null, createdAt: '2024-01-15T11:30:00Z' },
    ];

    const apiGetSpy = jest.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/hearts/users')) {
        return heartsData;
      }
      return {};
    });

    render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

    // Find and click the hearts counter
    const heartsCounter = screen.getByText('3')
    fireEvent.click(heartsCounter)

    // Wait for the API call
    await waitFor(() => {
      expect(apiGetSpy).toHaveBeenCalledWith('/posts/test-post-1/hearts/users')
    })

    // Check that hearts viewer opens
    await waitFor(() => {
      expect(screen.getByText(/Hearts/i)).toBeInTheDocument()
      const heartsDialog = screen.getByRole('dialog', { name: /Hearts/i });
      expect(within(heartsDialog).getByText('user1')).toBeInTheDocument();
      expect(within(heartsDialog).getByText('user2')).toBeInTheDocument();
    })
  })

  it('should handle hearts fetch error gracefully', async () => {
    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    // Mock apiClient.get to reject for the hearts call
    jest.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/hearts/users')) {
        throw new Error('Network error');
      }
      return {};
    });

    render(<PostCard post={mockPost} currentUserId="test-user-1" onUserClick={jest.fn()} />)

    // Find and click the hearts counter
    const heartsCounter = screen.getByText('3')
    await act(async () => {
      fireEvent.click(heartsCounter)
    })

    // Wait for the error toast to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Unable to load hearts/i)).toBeInTheDocument()
    })

    // Hearts viewer should not open
    expect(screen.queryByText('Hearts')).not.toBeInTheDocument()
  })


  it('should show hearts counter with 0 when count is 0', () => {
    const postWithNoHearts = { ...mockPost, heartsCount: 0 }
    render(<PostCard post={postWithNoHearts} onUserClick={jest.fn()} />)

    // Hearts counter should show 0 - find all buttons with "0" and check the first one (hearts)
    const zeroButtons = screen.getAllByText('0')
    expect(zeroButtons).toHaveLength(3) // hearts, reactions, and comments
    expect(zeroButtons[0]).toBeInTheDocument() // hearts counter
  })
})

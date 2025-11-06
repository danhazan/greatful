
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { apiClient } from '@/utils/apiClient';
import * as auth from '@/utils/auth';

jest.mock('@/utils/apiClient');
jest.mock('@/utils/auth');

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedAuth = auth as jest.Mocked<typeof auth>;

// Test component that uses UserContext
function TestComponent() {
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (currentUser) {
    return (
      <div>
        <div data-testid="user-id">{currentUser.id}</div>
        <div data-testid="user-name">{currentUser.name}</div>
        <div data-testid="user-email">{currentUser.email}</div>
      </div>
    );
  }

  return <div>Not authenticated</div>;
}

describe('UserContext Authentication Fix', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should correctly parse wrapped API response from backend', async () => {
    const mockUser = {
      id: 123,
      name: 'Test User',
      email: 'test@example.com',
    };
    mockedAuth.getAccessToken.mockReturnValue('mock-token');
    mockedApiClient.getCurrentUserProfile.mockResolvedValue(mockUser);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('123');
    });

    expect(screen.getByTestId('user-name')).toHaveTextContent('Test User');
    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
    expect(mockedApiClient.getCurrentUserProfile).toHaveBeenCalled();
  });

  it('should handle authentication failure correctly', async () => {
    mockedAuth.getAccessToken.mockReturnValue('invalid-token');
    mockedApiClient.getCurrentUserProfile.mockRejectedValue(new Error('HTTP 401 Authentication failed'));

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });

    expect(mockedApiClient.getCurrentUserProfile).toHaveBeenCalled();
    expect(mockedAuth.logout).toHaveBeenCalled();
  });

  it('should handle missing token correctly', async () => {
    mockedAuth.getAccessToken.mockReturnValue(null);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });

    expect(mockedApiClient.getCurrentUserProfile).not.toHaveBeenCalled();
  });

  it('should handle malformed API response correctly', async () => {
    mockedAuth.getAccessToken.mockReturnValue('mock-token');
    mockedApiClient.getCurrentUserProfile.mockResolvedValue({} as any);

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });

    expect(mockedApiClient.getCurrentUserProfile).toHaveBeenCalled();
    expect(mockedAuth.logout).toHaveBeenCalled();
  });
});

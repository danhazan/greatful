import React from 'react';
import { render, act, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as auth from '@/utils/auth';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock the entire auth module
jest.mock('@/utils/auth', () => ({
  logout: jest.fn(),
  login: jest.fn(),
  getAccessToken: jest.fn(),
  isAuthenticated: jest.fn(),
  canInteract: jest.fn(),
}));

const mockedAuth = auth as jest.Mocked<typeof auth>;

const TestComponent: React.FC = () => {
  const {
    currentUser,
    userProfiles,
    followStates,
    updateUserProfile,
    updateFollowState,
    updateCurrentUser,
    getUserProfile,
    getFollowState,
    subscribeToStateUpdates,
  } = useUser();

  const [events, setEvents] = React.useState<any[]>([]);

  React.useEffect(() => {
    const unsubscribe = subscribeToStateUpdates((event) => {
      setEvents((prev) => [...prev, event]);
    });
    return unsubscribe;
  }, [subscribeToStateUpdates]);

  return (
    <div>
      <div data-testid="current-user">
        {currentUser ? JSON.stringify(currentUser) : 'No user'}
      </div>
      <div data-testid="user-profiles">
        {JSON.stringify(userProfiles)}
      </div>
      <div data-testid="follow-states">
        {JSON.stringify(followStates)}
      </div>
      <div data-testid="events">{JSON.stringify(events)}</div>
      <button
        data-testid="update-profile"
        onClick={() => updateUserProfile('user123', { display_name: 'Updated Name' })}
      >
        Update Profile
      </button>
      <button
        data-testid="update-follow"
        onClick={() => updateFollowState('user456', true)}
      >
        Update Follow
      </button>
      <button
        data-testid="update-current-user"
        onClick={() => updateCurrentUser({ name: 'New Current User Name' })}
      >
        Update Current User
      </button>
      <div data-testid="get-profile">
        {JSON.stringify(getUserProfile('user123'))}
      </div>
      <div data-testid="get-follow-state">
        {getFollowState('user456').toString()}
      </div>
    </div>
  );
};

describe('Enhanced UserContext', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should handle authentication failure', async () => {
    // Mock failed authentication
    mockLocalStorage.getItem.mockReturnValue('invalid-token');
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(
      <UserProvider>
        <TestComponent />
      </UserProvider>
    );

    await waitFor(() => {
      // Check that user is null
      expect(screen.getByTestId('current-user')).toHaveTextContent('No user');
      
      // Check that auth.logout was called
      expect(mockedAuth.logout).toHaveBeenCalled();
    });
  });
});
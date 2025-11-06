
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { UserProvider } from '../../contexts/UserContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import { NextRouter } from 'next/router';

// Function to create a mock router
export function createMockRouter(router?: Partial<NextRouter>): NextRouter {
  return {
    basePath: '',
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    back: jest.fn(),
    beforePopState: jest.fn(),
    prefetch: jest.fn(),
    push: jest.fn(),
    reload: jest.fn(),
    replace: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isLocaleDomain: false,
    isReady: true,
    defaultLocale: 'en',
    domainLocales: [],
    isPreview: false,
    ...router,
  };
}

// Mock the global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});


jest.mock('../../utils/auth', () => ({
  __esModule: true,
  ...jest.requireActual('../../utils/auth'),
  logout: jest.fn(),
  login: jest.fn(),
  getAccessToken: jest.fn(),
  isAuthenticated: jest.fn(),
  canInteract: jest.fn(),
}));





const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RouterContext.Provider value={createMockRouter({})}>
      <ToastProvider>
        <UserProvider>{children}</UserProvider>
      </ToastProvider>
    </RouterContext.Provider>
  );
};

const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: TestWrapper, ...options });

export * from '@testing-library/react';
export { customRender as render };

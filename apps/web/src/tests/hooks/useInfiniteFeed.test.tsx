import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useInfiniteFeed } from '@/hooks/useInfiniteFeed'
import { apiClient } from '@/utils/apiClient'

const mockedApiClient = apiClient as unknown as { get: jest.Mock }

function createRawPost(id: string, authorId: string = 'author-1') {
  return {
    id,
    content: `Post ${id}`,
    author: {
      id: authorId,
      username: `user-${authorId}`,
      name: `User ${authorId}`,
      followerCount: 0,
      followingCount: 0,
      postsCount: 0,
      isFollowing: false,
    },
    createdAt: `2025-01-01T00:00:0${id.slice(-1)}Z`,
    reactionsCount: 0,
    commentsCount: 0,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function TestInfiniteFeed({ enabled = true }: { enabled?: boolean }) {
  const {
    items,
    nextCursor,
    hasMore,
    isInitialLoading,
    isFetchingNextPage,
    error,
    refresh,
    loadNextPage,
  } = useInfiniteFeed({
    enabled,
    currentUserId: undefined,
  })

  return (
    <div>
      <div data-testid="item-ids">{items.map((post) => post.id).join(',')}</div>
      <div data-testid="next-cursor">{nextCursor ?? ''}</div>
      <div data-testid="has-more">{hasMore ? 'true' : 'false'}</div>
      <div data-testid="is-initial-loading">{isInitialLoading ? 'true' : 'false'}</div>
      <div data-testid="is-fetching-next">{isFetchingNextPage ? 'true' : 'false'}</div>
      <div data-testid="error">{error?.message ?? ''}</div>
      <button onClick={() => void loadNextPage()}>load-next</button>
      <button onClick={() => void refresh()}>refresh</button>
    </div>
  )
}

describe('useInfiniteFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedApiClient.get = jest.fn()
  })

  it('loads the initial page and deduplicates overlapping pagination results', async () => {
    mockedApiClient.get
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-2',
      } as any)
      .mockResolvedValueOnce({
        posts: [createRawPost('2'), createRawPost('3')],
        nextCursor: null,
      } as any)

    render(<TestInfiniteFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('load-next'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2,3')
    })

    expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    expect(mockedApiClient.get).toHaveBeenCalledTimes(2)
  })

  it('prevents concurrent requests for the same cursor', async () => {
    const nextPage = deferred<any>()

    mockedApiClient.get
      .mockResolvedValueOnce({
        posts: [createRawPost('1')],
        nextCursor: 'cursor-1',
      } as any)
      .mockImplementationOnce(() => nextPage.promise)

    render(<TestInfiniteFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('load-next'))
      fireEvent.click(screen.getByText('load-next'))
    })

    expect(mockedApiClient.get).toHaveBeenCalledTimes(2)

    await act(async () => {
      nextPage.resolve({
        posts: [createRawPost('2')],
        nextCursor: null,
      } as any)
      await nextPage.promise
    })

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2')
    })
  })

  it('stops pagination when a page yields no new unique ids', async () => {
    mockedApiClient.get
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-2',
      } as any)
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-3',
      } as any)

    render(<TestInfiniteFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('load-next'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    })

    expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2')
  })

  it('ignores stale pagination responses after refresh starts a new session', async () => {
    const nextPage = deferred<any>()

    mockedApiClient.get
      .mockResolvedValueOnce({
        posts: [createRawPost('1')],
        nextCursor: 'cursor-1',
      } as any)
      .mockImplementationOnce(() => nextPage.promise)
      .mockResolvedValueOnce({
        posts: [createRawPost('10')],
        nextCursor: null,
      } as any)

    render(<TestInfiniteFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('load-next'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('10')
    })

    await act(async () => {
      nextPage.resolve({
        posts: [createRawPost('2')],
        nextCursor: null,
      } as any)
      await nextPage.promise
    })

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('10')
    })
  })

  it('warns when pagination makes no progress repeatedly', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    mockedApiClient.get
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-2',
      } as any)
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-3',
      } as any)
      .mockResolvedValueOnce({
        posts: [createRawPost('1'), createRawPost('2')],
        nextCursor: 'cursor-4',
      } as any)

    render(<TestInfiniteFeed />)

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('1,2')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('load-next'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('has-more')).toHaveTextContent('false')
    })

    expect(warnSpy).toHaveBeenCalledWith('[FEED] pagination stalled', {
      cursor: 'cursor-2',
      sessionVersion: 1,
      noProgressCount: 1,
    })
  })
})

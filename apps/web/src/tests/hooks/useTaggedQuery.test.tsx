import React, { StrictMode } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useTaggedQuery } from '@/hooks/useTaggedQuery'
import { queryKeys, queryTags } from '@/utils/queryKeys'
import { taggedQueryCache } from '@/utils/apiCache'

type TestQueryProps = {
  fetcher: () => Promise<{ value: string }>
  policy?: 'network-first' | 'cache-first-until-invalidated'
}

function TestQuery({ fetcher, policy = 'network-first' }: TestQueryProps) {
  const result = useTaggedQuery({
    queryKey: queryKeys.feed(),
    tags: [queryTags.feed],
    policy,
    fetcher,
    enabled: true,
    viewerScope: 'anon',
  })

  return (
    <div
      data-testid="query-state"
      data-loading={result.isLoading ? 'true' : 'false'}
      data-fetching={result.isFetching ? 'true' : 'false'}
      data-stale={result.isStale ? 'true' : 'false'}
      data-value={result.data?.value ?? ''}
      data-error={result.error?.message ?? ''}
    />
  )
}

describe('useTaggedQuery', () => {
  beforeEach(() => {
    taggedQueryCache.setViewerScope('anon')
    taggedQueryCache.reset()
    jest.clearAllMocks()
  })

  it('fetches once for network-first queries across rerenders', async () => {
    const fetcher = jest.fn(async () => ({ value: 'fresh' }))

    const { rerender } = render(
      <TestQuery fetcher={fetcher} policy="network-first" />
    )

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    rerender(<TestQuery fetcher={fetcher} policy="network-first" />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('deduplicates strict-mode mount fetches for the same semantic query', async () => {
    const fetcher = jest.fn(async () => {
      await Promise.resolve()
      return { value: 'strict' }
    })

    render(
      <StrictMode>
        <TestQuery fetcher={fetcher} policy="network-first" />
      </StrictMode>
    )

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  it('refetches once when an active query is invalidated', async () => {
    const fetcher = jest.fn(async () => ({ value: `value-${fetcher.mock.calls.length + 1}` }))

    render(<TestQuery fetcher={fetcher} policy="cache-first-until-invalidated" />)

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    act(() => {
      taggedQueryCache.invalidateTags([queryTags.feed], { viewerScope: 'anon' })
    })

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2)
    })
  })
})

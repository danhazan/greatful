import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { canonicalizeTags, serializeQueryKey, serializeQueryTags, taggedQueryCache } from '@/utils/apiCache'

describe('taggedQueryCache', () => {
  beforeEach(() => {
    taggedQueryCache.setViewerScope('anon')
    taggedQueryCache.reset()
  })

  it('serializes canonical query keys consistently', () => {
    expect(serializeQueryKey(['feed'])).toBe('["feed"]')
    expect(serializeQueryKey(['userPosts', '42'])).toBe('["userPosts","42"]')
  })

  it('canonicalizes query tags consistently', () => {
    expect(canonicalizeTags(['userPosts:42', 'feed', 'feed'])).toEqual(['feed', 'userPosts:42'])
    expect(serializeQueryTags(['userPosts:42', 'feed', 'feed'])).toBe('["feed","userPosts:42"]')
  })

  it('batches multi-tag invalidation to one refetch per query', async () => {
    const callback = jest.fn()

    taggedQueryCache.subscribe(['post', 'abc'], ['post:abc', 'postComments:abc'], callback, 'anon')

    taggedQueryCache.invalidateTags(['post:abc', 'postComments:abc'], { viewerScope: 'anon' })
    await Promise.resolve()

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith('tagInvalidation')
  })

  it('removes subscribers on unsubscribe', async () => {
    const callback = jest.fn()
    const unsubscribe = taggedQueryCache.subscribe(['feed'], ['feed'], callback, 'anon')

    unsubscribe()
    taggedQueryCache.invalidateTags(['feed'], { viewerScope: 'anon' })
    await Promise.resolve()

    expect(callback).not.toHaveBeenCalled()
  })

  it('drops stale writes when version no longer matches', () => {
    const queryKey = ['userPosts', '42'] as const
    const tags = ['userPosts:42']

    const initialVersion = taggedQueryCache.getVersion(queryKey, tags, 'anon')
    expect(initialVersion).toBe(0)

    taggedQueryCache.invalidateTags(tags, { viewerScope: 'anon' })

    const applied = taggedQueryCache.setData(queryKey, tags, [{ id: 'old' }], {
      viewerScope: 'anon',
      version: initialVersion,
    })

    expect(applied).toBe(false)
    expect(taggedQueryCache.getSnapshot(queryKey, tags, 'anon').data).toBeUndefined()
  })

  it('reuses one in-flight promise per query version', async () => {
    const queryKey = ['feed'] as const
    const tags = ['feed']
    const fetcher = jest.fn(async () => {
      await Promise.resolve()
      return { posts: [] }
    })

    const requestVersion = taggedQueryCache.getVersion(queryKey, tags, 'anon')
    const firstPromise = taggedQueryCache.runWithInFlight(queryKey, tags, {
      viewerScope: 'anon',
      version: requestVersion,
      fetcher,
    })
    const secondPromise = taggedQueryCache.runWithInFlight(queryKey, tags, {
      viewerScope: 'anon',
      version: requestVersion,
      fetcher,
    })

    expect(firstPromise).toBe(secondPromise)

    await firstPromise
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps viewer scopes on separate query versions', () => {
    const queryKey = ['feed'] as const
    const tags = ['feed']

    const anonVersion = taggedQueryCache.getVersion(queryKey, tags, 'anon')
    expect(anonVersion).toBe(0)

    const anonApplied = taggedQueryCache.setData(queryKey, tags, { posts: ['anon'] }, {
      viewerScope: 'anon',
      version: anonVersion,
    })

    expect(anonApplied).toBe(true)
    expect(taggedQueryCache.getSnapshot<{ posts: string[] }>(queryKey, tags, 'anon').data).toEqual({ posts: ['anon'] })

    const userVersion = taggedQueryCache.getVersion(queryKey, tags, 'user:1')
    expect(userVersion).toBe(0)

    const userApplied = taggedQueryCache.setData(queryKey, tags, { posts: ['user'] }, {
      viewerScope: 'user:1',
      version: userVersion,
    })

    expect(userApplied).toBe(true)
    expect(taggedQueryCache.getSnapshot<{ posts: string[] }>(queryKey, tags, 'user:1').data).toEqual({ posts: ['user'] })
    expect(taggedQueryCache.getSnapshot<{ posts: string[] }>(queryKey, tags, 'anon').data).toEqual({ posts: ['anon'] })
  })

  it('does not let an old viewer scope response overwrite the current scope', () => {
    const queryKey = ['currentUserProfile'] as const
    const tags = ['currentUserProfile']

    taggedQueryCache.setViewerScope('user:1')
    const userVersion = taggedQueryCache.getVersion(queryKey, tags, 'user:1')

    const oldAnonApplied = taggedQueryCache.setData(queryKey, tags, { id: 'anon' }, {
      viewerScope: 'anon',
      version: 0,
    })
    const currentUserApplied = taggedQueryCache.setData(queryKey, tags, { id: '1' }, {
      viewerScope: 'user:1',
      version: userVersion,
    })

    expect(oldAnonApplied).toBe(true)
    expect(currentUserApplied).toBe(true)
    expect(taggedQueryCache.getSnapshot<{ id: string }>(queryKey, tags, 'user:1').data).toEqual({ id: '1' })
  })

  it('resets entries when viewer scope changes', () => {
    const queryKey = ['currentUserProfile'] as const
    const tags = ['currentUserProfile']

    taggedQueryCache.setData(queryKey, tags, { id: '1' }, { viewerScope: 'anon', version: 0 })
    expect(taggedQueryCache.getStats().entries).toBe(1)

    taggedQueryCache.setViewerScope('user:1')

    expect(taggedQueryCache.getStats().entries).toBe(0)
    expect(taggedQueryCache.getViewerScope()).toBe('user:1')
  })
})

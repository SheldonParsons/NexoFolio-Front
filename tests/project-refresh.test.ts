import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProjectRefreshLoading,
  projectIdForDocumentLoad,
} from '../src/app/projectRefreshLoading'
import { createApiClient } from '../src/api/client'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('project document-load scope (address-bar Enter and reload)', () => {
  it.each([
    '/projects/project-a/catalog',
    '/projects/project-a/catalog/interface/123123123',
    '/projects/project-a/catalog/interface/123/details?environment=test#schema',
    '/projects/project-a/interfaces',
    '/projects/project-a/maintenance',
  ])('recognizes project descendants independently of route names: %s', (path) => {
    expect(projectIdForDocumentLoad(path)).toBe('project-a')
  })
  it.each(['/projects', '/projects/', '/settings', '/projects-other/a/catalog', '/'])(
    'excludes %s',
    (path) => {
      expect(projectIdForDocumentLoad(path)).toBeNull()
    },
  )
  it('does not require Navigation Timing metadata at bootstrap', () => {
    expect(projectIdForDocumentLoad('/projects/a/catalog')).toBe('a')
  })
})

describe('initial project loading ownership', () => {
  it('waits through authentication and mounting before considering the page ready', async () => {
    const loading = createProjectRefreshLoading(),
      ready = vi.fn()
    const mounted = loading.start('a', ready)
    loading.request('v1/auth/me')!()
    await vi.runAllTimersAsync()
    expect(ready).not.toHaveBeenCalled()
    const release = loading.request('v1/projects/a/catalog')!
    mounted()
    await vi.runAllTimersAsync()
    expect(ready).not.toHaveBeenCalled()
    release()
    await vi.runAllTimersAsync()
    expect(ready).toHaveBeenCalledOnce()
  })
  it('does not finish in the gap between a directory response and its dependent list request', async () => {
    const loading = createProjectRefreshLoading(),
      ready = vi.fn()
    loading.start('a', ready)()
    const first = loading.request('v1/projects/a/catalog')!
    first()
    await Promise.resolve()
    const second = loading.request('v1/projects/a/catalog/interfaces')!
    await vi.runAllTimersAsync()
    expect(ready).not.toHaveBeenCalled()
    second()
    await vi.runAllTimersAsync()
    expect(ready).toHaveBeenCalledOnce()
    expect(loading.request('v1/projects/a/catalog')).toBeUndefined() // later polling
  })
  it('tracks parallel requests but excludes other projects and unrelated APIs', async () => {
    const loading = createProjectRefreshLoading(),
      ready = vi.fn()
    loading.start('a', ready)()
    const one = loading.request('v1/projects/a/catalog')!
    const two = loading.request('v1/projects/a/environments')!
    expect(loading.request('v1/projects/ab/catalog')).toBeUndefined()
    expect(loading.request('v1/telemetry')).toBeUndefined()
    one()
    one()
    await vi.runAllTimersAsync()
    expect(ready).not.toHaveBeenCalled()
    two()
    await vi.runAllTimersAsync()
    expect(ready).toHaveBeenCalledOnce()
  })
  it('keeps async source initialization inside the first-load task and releases a rejection', async () => {
    const loading = createProjectRefreshLoading(),
      ready = vi.fn()
    loading.start('a', ready)()
    let reject!: (error: Error) => void
    const task = loading.task(
      () =>
        new Promise<void>((_resolve, fail) => {
          reject = fail
        }),
    )
    const rejected = expect(task).rejects.toThrow('source failed')
    await vi.runAllTimersAsync()
    expect(ready).not.toHaveBeenCalled()
    reject(new Error('source failed'))
    await rejected
    await vi.runAllTimersAsync()
    expect(ready).toHaveBeenCalledOnce()
  })
  it('cancels a replaced load without accepting its late releases', async () => {
    const loading = createProjectRefreshLoading(),
      old = vi.fn(),
      ready = vi.fn()
    const oldMount = loading.start('a', old)
    const late = loading.request('v1/projects/a/catalog')!
    loading.cancel()
    const mounted = loading.start('b', ready)
    oldMount()
    late()
    await vi.runAllTimersAsync()
    expect(old).not.toHaveBeenCalled()
    expect(ready).not.toHaveBeenCalled()
    mounted()
    await vi.runAllTimersAsync()
    expect(ready).toHaveBeenCalledOnce()
  })
})

describe('request lifecycle release', () => {
  it.each([200, 403, 503])('releases HTTP %i after transport completes', async (status) => {
    const done = vi.fn(),
      start = vi.fn(() => done)
    const client = createApiClient({
      baseUrl: '/api',
      onRequestStart: start,
      fetcher: vi.fn().mockResolvedValue(Response.json({}, { status })),
    })
    await client.request('v1/projects/a/catalog').catch(() => {})
    expect(start).toHaveBeenCalledWith('v1/projects/a/catalog')
    expect(done).toHaveBeenCalledOnce()
  })
  it('waits for a slow response body instead of stopping on response headers', async () => {
    const done = vi.fn()
    let body!: (value: unknown) => void
    const client = createApiClient({
      baseUrl: '/api',
      onRequestStart: () => done,
      fetcher: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          new Promise((resolve) => {
            body = resolve
          }),
      }),
    })
    const request = client.request('v1/projects/a/catalog')
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    body({ ok: true })
    await request
    expect(done).toHaveBeenCalledOnce()
  })
  it('releases when an in-flight request times out', async () => {
    const done = vi.fn()
    const client = createApiClient({
      baseUrl: '/api',
      timeoutMs: 100,
      onRequestStart: () => done,
      fetcher: vi
        .fn()
        .mockImplementation(
          (_url, init) =>
            new Promise((_resolve, reject) =>
              init.signal.addEventListener('abort', () => reject(new Error('aborted'))),
            ),
        ),
    })
    const request = expect(client.request('v1/projects/a/catalog')).rejects.toMatchObject({
      kind: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(100)
    await request
    expect(done).toHaveBeenCalledOnce()
  })
})

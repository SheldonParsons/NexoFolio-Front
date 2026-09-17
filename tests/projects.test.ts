import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '../src/api/client'
import { createLiveProjectSource } from '../src/features/projects/repository'
import { mockProjects } from '../src/features/projects/mock'
import { readVisits, recordVisit, resolveRecent } from '../src/features/projects/recent'
import { clearBrowserViews, readBrowserView } from '../src/features/projects/browserState'
import { useProjectBrowser } from '../src/features/projects/useProjectBrowser'
import type { Project, ProjectPage, ProjectSource } from '../src/features/projects/types'

const project = (id: string): Project => ({
  project_id: id,
  name: id,
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
})
const result = (id: string, page = 1, total = 1): ProjectPage => ({
  items: [project(id)],
  page,
  limit: 10,
  total,
})
function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    data,
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const scopes: ReturnType<typeof effectScope>[] = []
function browser(source: ProjectSource, key = 'api:mock:user-a') {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useProjectBrowser(source, key, true))!
}
beforeEach(() => {
  vi.useFakeTimers()
  clearBrowserViews()
  vi.stubGlobal('localStorage', storage())
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('project sources', () => {
  it('searches the entire mock collection before pagination', async () => {
    const pending = mockProjects.list(
      { page: 1, limit: 10, q: '开放服务' },
      new AbortController().signal,
    )
    await vi.advanceTimersByTimeAsync(260)
    const data = await pending
    expect(data.total).toBe(1)
    expect(data.items[0]?.name).toBe('开放服务平台')
    const filtered = mockProjects.list(
      { page: 2, limit: 2, access_state: 'denied' },
      new AbortController().signal,
    )
    await vi.advanceTimersByTimeAsync(260)
    expect(await filtered).toMatchObject({
      page: 2,
      total: 3,
      items: [expect.objectContaining({ access_state: 'denied' })],
    })
  })
  it('never forwards unsupported filters to a legacy backend', async () => {
    const request = vi.fn().mockResolvedValue(result('a'))
    const source = createLiveProjectSource(request, false)
    await expect(
      source.list({ page: 1, limit: 10, q: '平台' }, new AbortController().signal),
    ).rejects.toThrow('尚未启用')
    expect(request).not.toHaveBeenCalled()
    await source.list({ page: 1, limit: 10 }, new AbortController().signal)
    expect(request.mock.calls[0]?.[0]).toBe('v1/projects?page=1&limit=10')
  })
  it('encodes enabled queries and rejects malformed pages', async () => {
    const request = vi.fn().mockResolvedValue(result('a'))
    const source = createLiveProjectSource(request, true)
    await source.list(
      { page: 1, limit: 10, q: ' A & B ', access_state: 'allowed' },
      new AbortController().signal,
    )
    expect(request.mock.calls[0]?.[0]).toBe(
      'v1/projects?page=1&limit=10&q=A+%26+B&access_state=allowed',
    )
    request.mockResolvedValue({ ...result('a'), total: -1 })
    await expect(source.list({ page: 1, limit: 10 }, new AbortController().signal)).rejects.toThrow(
      '格式',
    )
  })
})

describe('recent visits', () => {
  it('keeps only 20 IDs and timestamps, isolates identity and mode, and deduplicates', () => {
    const store = storage()
    for (let i = 0; i < 25; i++) recordVisit('api:mock:a', String(i), store, i)
    recordVisit('api:mock:a', '20', store, 30)
    expect(readVisits('api:mock:a', store)).toHaveLength(20)
    expect(readVisits('api:mock:a', store)[0]).toEqual({ id: '20', visitedAt: 30 })
    expect(readVisits('api:mock:b', store)).toEqual([])
    expect(readVisits('api:live:a', store)).toEqual([])
    expect(readVisits('other-api:mock:a', store)).toEqual([])
    expect(Object.keys(readVisits('api:mock:a', store)[0]!)).toEqual(['id', 'visitedAt'])
  })
  it('removes 403/404, retains transient failures and never uses stale cached names to enter', async () => {
    const store = storage()
    for (const [i, id] of ['forbidden', 'missing', 'offline'].entries())
      recordVisit('a', id, store, i)
    const get = vi.fn(async (id: string) => {
      throw new ApiError('failed', 'http', id === 'forbidden' ? 403 : id === 'missing' ? 404 : 503)
    })
    expect(
      await resolveRecent('a', { get, list: vi.fn() }, [], new AbortController().signal, store),
    ).toEqual([])
    expect(readVisits('a', store)).toEqual([{ id: 'offline', visitedAt: 2 }])
  })
  it('makes at most three simultaneous detail reads and preserves newly written visits', async () => {
    const store = storage()
    for (let i = 0; i < 6; i++) recordVisit('a', String(i), store, i)
    const pending = deferred<Project>()
    const get = vi.fn(() => pending.promise)
    const resolving = resolveRecent(
      'a',
      { get, list: vi.fn() },
      [],
      new AbortController().signal,
      store,
    )
    expect(get).toHaveBeenCalledTimes(3)
    recordVisit('a', 'new', store, 10)
    pending.reject(new ApiError('removed', 'http', 404))
    expect(await resolving).toEqual([])
    expect(readVisits('a', store).map((entry) => entry.id)).toEqual(['new', '2', '1', '0'])
  })
  it('does not delete visits when aborted or block use with unavailable storage', async () => {
    const store = storage()
    recordVisit('a', 'a', store, 1)
    const controller = new AbortController()
    controller.abort()
    await resolveRecent(
      'a',
      { list: vi.fn(), get: vi.fn().mockRejectedValue(new ApiError('failed', 'http', 403)) },
      [],
      controller.signal,
      store,
    )
    expect(readVisits('a', store)).toHaveLength(1)
    const broken = {
      getItem() {
        throw Error('denied')
      },
      setItem() {
        throw Error('quota')
      },
    }
    expect(() => recordVisit('a', 'x', broken)).not.toThrow()
    expect(readVisits('a', broken)).toEqual([])
  })
})

describe('project query coordination', () => {
  it('debounces input, protects IME, and makes Enter submit immediately', async () => {
    const list = vi.fn().mockResolvedValue(result('a'))
    const view = browser({ list, get: vi.fn() })
    view.compositionStart()
    view.changeQuery('平')
    await vi.advanceTimersByTimeAsync(500)
    expect(list).not.toHaveBeenCalled()
    view.compositionEnd('平台')
    await vi.advanceTimersByTimeAsync(249)
    expect(list).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(list.mock.calls[0]?.[0].q).toBe('平台')
    view.changeQuery('服务')
    view.submitQuery()
    expect(list).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(500)
    expect(list).toHaveBeenCalledTimes(2)
  })
  it('keeps old results busy, delays progress and ignores an aborted server response', async () => {
    const slow = deferred<ProjectPage>()
    const latest = deferred<ProjectPage>()
    const list = vi
      .fn()
      .mockResolvedValueOnce(result('initial'))
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(latest.promise)
    const view = browser({ list, get: vi.fn() })
    await view.load()
    view.changeQuery('old')
    view.submitQuery()
    expect(view.busy.value).toBe(true)
    expect(view.items.value[0]?.name).toBe('initial')
    await vi.advanceTimersByTimeAsync(119)
    expect(view.showProgress.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(view.showProgress.value).toBe(true)
    const oldSignal = list.mock.calls[1]?.[1] as AbortSignal
    view.changeQuery('new')
    view.submitQuery()
    expect(oldSignal.aborted).toBe(true)
    latest.resolve(result('new'))
    await vi.advanceTimersByTimeAsync(0)
    slow.resolve(result('old'))
    await vi.advanceTimersByTimeAsync(0)
    expect(view.items.value[0]?.name).toBe('new')
    expect(view.busy.value).toBe(false)
  })
  it('retains failed queries and retries, clamps vanished pages', async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(Error('offline'))
      .mockResolvedValueOnce(result('recovered'))
    const view = browser({ list, get: vi.fn() })
    view.changeQuery('平台')
    view.submitQuery()
    await vi.advanceTimersByTimeAsync(0)
    expect(view.query.value).toBe('平台')
    expect(view.error.value).toBeInstanceOf(Error)
    await view.load()
    expect(view.error.value).toBeNull()
    view.page.value = 3
    list.mockResolvedValue({ ...result('a'), items: [], page: 3, total: 5 })
    list
      .mockResolvedValueOnce({ ...result('a'), items: [], page: 3, total: 5 })
      .mockResolvedValueOnce({ ...result('a'), total: 5 })
    await view.load()
    expect(view.page.value).toBe(1)
    expect(view.items.value[0]?.name).toBe('a')
  })
  it('restores filters/page/scroll, and cannot repopulate a cleared account cache on unmount', async () => {
    const source = { list: vi.fn().mockResolvedValue(result('a', 2, 18)), get: vi.fn() }
    const first = browser(source)
    first.page.value = 2
    first.query.value = '平台'
    first.scrollTop.value = 180
    await first.load()
    scopes[0]!.stop()
    const returning = browser(source)
    expect([returning.page.value, returning.query.value, returning.scrollTop.value]).toEqual([
      2,
      '平台',
      180,
    ])
    expect(returning.restoreScroll.value).toBe(true)
    clearBrowserViews()
    scopes[1]!.stop()
    expect(readBrowserView('api:mock:user-a').result).toBeNull()
    expect(browser(source, 'api:mock:user-b').items.value).toEqual([])
  })
})

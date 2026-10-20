import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '../src/api/client'
import { curationLabel, curatorLabel } from '../src/features/projects/curation'
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
  return scope.run(() => useProjectBrowser(source, key))!
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
  })
  it('encodes enabled queries and rejects malformed pages', async () => {
    const request = vi.fn().mockResolvedValue(result('a'))
    const source = createLiveProjectSource(request)
    await source.list({ page: 1, limit: 10, q: ' A & B ' }, new AbortController().signal)
    expect(request.mock.calls[0]?.[0]).toBe('v1/projects?page=1&limit=10&q=A+%26+B')
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
  it('hydrates five visits in timestamp order from the existing v1 cache, with bounded backfill', async () => {
    const store = storage()
    store.setItem(
      'nexofolio.recent-projects.v1:a',
      JSON.stringify([
        { id: 'old', visitedAt: 1, name: 'stale' },
        ...Array.from({ length: 7 }, (_, i) => ({ id: String(i), visitedAt: i + 2 })),
        { id: 'invalid', visitedAt: 'bad' },
        { id: '3', visitedAt: 0 },
      ]),
    )
    const list = vi.fn().mockResolvedValue({
      items: [
        project('old'),
        ...[0, 1, 2, 3, 4].map((i) => project(String(i))),
        { ...project('5'), access_state: 'denied', can_access: false },
      ],
    })
    const rows = await resolveRecent(
      'a',
      { list, get: vi.fn() },
      [],
      new AbortController().signal,
      store,
    )
    expect(rows.map((p) => p.project_id)).toEqual(['4', '3', '2', '1', '0'])
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0]?.[0]).toMatchObject({
      page: 1,
      limit: 20,
      ids: ['6', '5', '4', '3', '2', '1', '0', 'old'],
    })
    expect(readVisits('a', store).map((v) => v.id)).toEqual(['4', '3', '2', '1', '0', 'old'])
  })
  it('retains visits on transient failures, and preserves new visits during hydration', async () => {
    const store = storage()
    recordVisit('a', 'removed', store, 1)
    const pending = deferred<ProjectPage>()
    const list = vi.fn().mockReturnValue(pending.promise)
    const resolving = resolveRecent(
      'a',
      { list, get: vi.fn() },
      [],
      new AbortController().signal,
      store,
    )
    recordVisit('a', 'new', store, 10)
    pending.resolve({ items: [], page: 1, limit: 20, total: 0 })
    expect(await resolving).toEqual([])
    expect(readVisits('a', store)).toEqual([{ id: 'new', visitedAt: 10 }])
    list.mockRejectedValue(new ApiError('offline', 'http', 503))
    await expect(
      resolveRecent('a', { list, get: vi.fn() }, [], new AbortController().signal, store),
    ).rejects.toThrow('offline')
    expect(readVisits('a', store)).toHaveLength(1)
  })
  it('does not delete visits when aborted or block use with unavailable storage', async () => {
    const store = storage()
    recordVisit('a', 'a', store, 1)
    const controller = new AbortController()
    controller.abort()
    await resolveRecent('a', { list: vi.fn(), get: vi.fn() }, [], controller.signal, store)
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
  it('clears search back to all projects and resets the page after no matches', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 })
      .mockResolvedValue(result('all'))
    const view = browser({ list, get: vi.fn() })
    view.page.value = 5
    view.changeQuery('  NOT FOUND  ')
    view.submitQuery()
    await vi.advanceTimersByTimeAsync(0)
    expect(list.mock.calls[0]?.[0]).toEqual({ page: 1, limit: 10, q: 'NOT FOUND' })
    expect(view.items.value).toEqual([])
    view.clearQuery()
    await vi.advanceTimersByTimeAsync(0)
    expect(list.mock.calls[1]?.[0]).toEqual({ page: 1, limit: 10 })
    expect(view.activeFilters.value).toBe(false)
    expect(view.items.value[0]?.name).toBe('all')
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

describe('curation display', () => {
  it('shows exact states, Shanghai start time, and honest missing history', () => {
    expect(curationLabel(null)).toBe('无')
    expect(curatorLabel(null)).toBe('无')
    const summary = {
      id: 'round',
      state: 'done' as const,
      started_at: '2026-10-17T01:02:03Z',
      actor_name: '  张三  ',
    }
    expect(curationLabel(summary)).toBe('2026-10-17 09:02:03')
    expect(curatorLabel(summary)).toBe('张三')
    expect(curationLabel({ ...summary, started_at: null })).toBe('已完成 · 开始时间未知')
    expect(curatorLabel({ ...summary, actor_name: '  ' })).toBe('未知')
    for (const [state, label] of Object.entries({
      running: '正在整理',
      queued: '排队中',
      waiting: '等待重试',
      needs_attention: '需要处理',
      failed: '整理失败',
      stopped: '已停止',
    }))
      expect(curationLabel({ ...summary, state: state as typeof summary.state })).toBe(label)
  })
})

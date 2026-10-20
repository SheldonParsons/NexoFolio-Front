import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { readVisits, recordVisit, removeVisit, resolveRecent } from '@/features/projects/recent'
import { clearBrowserViews, saveBrowserView } from '@/features/projects/browserState'
import { useNavigationRecentProjects } from '@/features/navigation/useNavigationRecentProjects'
import type { Project, ProjectPage } from '@/features/projects/types'

const project = (id: string): Project => ({
  project_id: id,
  name: id,
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
})
const page = (items: Project[]): ProjectPage => ({ items, total: items.length, page: 1, limit: 20 })
const scopes: ReturnType<typeof effectScope>[] = []
const owner = 'intranet/api:live:a'
function setup(list = vi.fn().mockResolvedValue(page([]))) {
  const scope = ref(owner)
  const enabled = ref(false)
  const lifecycle = effectScope()
  scopes.push(lifecycle)
  const source = { list, get: vi.fn() }
  const recent = lifecycle.run(() => useNavigationRecentProjects(source, scope, enabled))!
  return { scope, enabled, source, recent }
}
const flush = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
beforeEach(() => {
  vi.useFakeTimers()
  clearBrowserViews()
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('reuses the page snapshot, shows four while the shared resolver still returns five, and never records hover', async () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map(project)
  rows.forEach((p, index) => recordVisit(owner, p.project_id, undefined, index))
  recordVisit(owner, 'c', undefined, 20)
  saveBrowserView(owner, {
    query: '',
    page: 1,
    scrollTop: 0,
    result: page(rows),
    validatedAt: Date.now(),
  })
  const { enabled, source, recent } = setup()
  const before = readVisits(owner)
  enabled.value = true
  await flush()
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['c', 'f', 'e', 'd'])
  expect(await resolveRecent(owner, source, rows, new AbortController().signal)).toHaveLength(5)
  enabled.value = false
  await flush()
  enabled.value = true
  await flush()
  expect(source.list).not.toHaveBeenCalled()
  expect(source.get).not.toHaveBeenCalled()
  expect(readVisits(owner)).toEqual(before)
})
it.each([1, 2, 3])(
  'shows exactly %i visits and reacts to removal and successful entry notifications',
  async (count) => {
    const rows = Array.from({ length: count }, (_, i) => project(String(i)))
    const { enabled, source, recent } = setup(vi.fn().mockResolvedValue(page(rows)))
    rows.forEach((p, index) => recordVisit(owner, p.project_id, undefined, index))
    enabled.value = true
    await flush()
    expect(recent.items.value).toHaveLength(count)
    removeVisit(owner, '0')
    await flush()
    expect(recent.items.value).toHaveLength(count - 1)
    recordVisit(owner, '0', undefined, 30)
    await flush()
    expect(recent.items.value[0]?.project_id).toBe('0')
    expect(source.get).not.toHaveBeenCalled()
  },
)
it('clears immediately on account or service switch and ignores even an uncooperative late response', async () => {
  recordVisit(owner, 'old')
  let finish!: (value: ProjectPage) => void
  const list = vi.fn().mockImplementation(
    () =>
      new Promise<ProjectPage>((resolve) => {
        finish = resolve
      }),
  )
  const { scope, enabled, recent } = setup(list)
  enabled.value = true
  await flush()
  const oldSignal = list.mock.calls[0]![1] as AbortSignal
  scope.value = 'intranet/api:live:b'
  expect(oldSignal.aborted).toBe(true)
  expect(recent.items.value).toEqual([])
  await flush()
  finish(page([project('old')]))
  await flush()
  expect(recent.items.value).toEqual([])
  expect(readVisits(owner)).toHaveLength(1)
  scope.value = 'internet/api:live:a'
  await flush()
  expect(recent.items.value).toEqual([])
  expect(list).toHaveBeenCalledTimes(1)
})
it('uses one bounded batch, omits deleted/denied/unknown rows and retains unknown and failed histories', async () => {
  for (let i = 0; i < 25; i++) recordVisit(owner, String(i), undefined, i)
  const rows = [
    project('22'),
    { ...project('23'), can_access: false, access_state: 'denied' as const },
    { ...project('24'), can_access: false, access_state: 'unknown' as const },
  ]
  const { source, enabled, recent } = setup(vi.fn().mockResolvedValue(page(rows)))
  enabled.value = true
  await flush()
  expect(source.list.mock.calls[0]![0].ids).toHaveLength(20)
  expect(source.list).toHaveBeenCalledTimes(1)
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['22'])
  expect(readVisits(owner).map((v) => v.id)).toEqual(['24', '22'])
  source.list.mockRejectedValue(Error('offline'))
  enabled.value = false
  await flush()
  await vi.advanceTimersByTimeAsync(30_001)
  enabled.value = true
  await flush()
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['22'])
  expect(recent.message.value).toContain('暂不可用')
  expect(readVisits(owner).map((v) => v.id)).toEqual(['24', '22'])
})
it('distinguishes empty history from unconfirmed access without making an empty request', async () => {
  const { enabled, source, recent } = setup()
  enabled.value = true
  await flush()
  expect(recent.message.value).toBe('访问项目后会显示在这里。')
  expect(source.list).not.toHaveBeenCalled()
  source.list.mockResolvedValue(
    page([{ ...project('unknown'), access_state: 'unknown', can_access: false }]),
  )
  recordVisit(owner, 'unknown')
  await flush()
  expect(recent.items.value).toEqual([])
  expect(recent.message.value).toContain('暂不可用')
  expect(readVisits(owner)).toHaveLength(1)
})
it('revalidates old page snapshots before displaying a deleted project', async () => {
  recordVisit(owner, 'gone')
  saveBrowserView(owner, {
    query: '',
    page: 1,
    scrollTop: 0,
    result: page([project('gone')]),
    validatedAt: Date.now() - 30_001,
  })
  const { source, enabled, recent } = setup()
  enabled.value = true
  await flush()
  expect(source.list).toHaveBeenCalledTimes(1)
  expect(recent.items.value).toEqual([])
  expect(readVisits(owner)).toEqual([])
})
it('notices history pruned by another consumer on reopening within the cache window', async () => {
  recordVisit(owner, 'a')
  const { enabled, recent } = setup(vi.fn().mockResolvedValue(page([project('a')])))
  enabled.value = true
  await flush()
  expect(recent.items.value).toHaveLength(1)
  enabled.value = false
  await flush()
  await resolveRecent(
    owner,
    { list: vi.fn().mockResolvedValue(page([])), get: vi.fn() },
    [],
    new AbortController().signal,
  )
  enabled.value = true
  await flush()
  expect(recent.items.value).toEqual([])
})
it('keeps confirmed recent projects when switching within the same account without another batch', async () => {
  const rows = [project('a'), project('b')]
  recordVisit(owner, 'a', undefined, 2)
  recordVisit(owner, 'b', undefined, 1)
  saveBrowserView(owner, {
    query: '',
    page: 1,
    scrollTop: 0,
    result: page(rows),
    validatedAt: Date.now(),
  })
  const { enabled, source, recent } = setup(vi.fn().mockRejectedValue(Error('batch unavailable')))
  enabled.value = true
  await flush()
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['a', 'b'])
  enabled.value = false
  await flush()
  recordVisit(owner, 'b', undefined, 3)
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['b', 'a'])
  enabled.value = true
  await flush()
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['b', 'a'])
  expect(source.list).not.toHaveBeenCalled()
})
it('keeps confirmed labels and the newly entered project when the next batch fails', async () => {
  recordVisit(owner, 'a', undefined, 1)
  recordVisit(owner, 'b', undefined, 2)
  const { enabled, source, recent, scope } = setup(
    vi.fn().mockResolvedValue(page([project('a'), project('b')])),
  )
  enabled.value = true
  await flush()
  enabled.value = false
  await flush()
  await vi.advanceTimersByTimeAsync(30_001)
  source.list.mockRejectedValue(Error('batch unavailable'))
  recordVisit(owner, project('new'))
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['new', 'b', 'a'])
  enabled.value = true
  await flush()
  expect(source.list.mock.calls[1]![0].ids).toEqual(['b', 'a'])
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['new', 'b', 'a'])
  expect(readVisits(owner).map((v) => v.id)).toEqual(['new', 'b', 'a'])
  expect(Object.keys(readVisits(owner)[0]!)).toEqual(['id', 'visitedAt'])
  scope.value = 'other-api:live:a'
  expect(recent.items.value).toEqual([])
  await flush()
  expect(recent.items.value).toEqual([])
})
it('does not renew old permission evidence just because a different project was entered', async () => {
  recordVisit(owner, 'a')
  const { enabled, source, recent } = setup(vi.fn().mockResolvedValue(page([project('a')])))
  enabled.value = true
  await flush()
  enabled.value = false
  await flush()
  await vi.advanceTimersByTimeAsync(20_000)
  recordVisit(owner, project('b'))
  enabled.value = true
  await flush()
  expect(source.list).toHaveBeenCalledTimes(1)
  enabled.value = false
  await flush()
  await vi.advanceTimersByTimeAsync(10_001)
  source.list.mockResolvedValue(
    page([{ ...project('a'), can_access: false, access_state: 'unknown' }]),
  )
  enabled.value = true
  await flush()
  expect(source.list.mock.calls[1]![0].ids).toEqual(['a'])
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['b'])
  expect(readVisits(owner).map((v) => v.id)).toEqual(['b', 'a'])
})
it('can restore the same account list after remounting even when revalidation fails', async () => {
  recordVisit(owner, 'a')
  saveBrowserView(owner, {
    query: '',
    page: 1,
    scrollTop: 0,
    result: page([project('a')]),
    validatedAt: Date.now() - 30_001,
  })
  const { enabled, source, recent } = setup(vi.fn().mockRejectedValue(Error('offline')))
  enabled.value = true
  await flush()
  expect(source.list).toHaveBeenCalledTimes(1)
  expect(recent.items.value.map((p) => p.project_id)).toEqual(['a'])
})

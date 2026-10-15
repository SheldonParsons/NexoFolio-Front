import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { freshness, number } from '@/features/operations/format'
import { useOperations } from '@/features/operations/useOperations'
import { api, ApiError } from '@/api'
const { mounted } = vi.hoisted(() => ({ mounted: [] as (() => void)[] }))
vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  onMounted: (fn: () => void) => mounted.push(fn),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  api: { request: vi.fn() },
}))
const auth = reactive({
  canManageProjects: true,
  user: { id: 'admin' },
  revokeManagement: vi.fn(() => {
    auth.canManageProjects = false
  }),
})
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
let scope: ReturnType<typeof effectScope>,
  doc: EventTarget & { hidden: boolean },
  win: EventTarget,
  network: { onLine: boolean }
const rows = (id = 'task', project_id = 'p', state = 'done') => ({
  page: { items: [{ id, project_id, state }], next: null, observed_at: new Date().toISOString() },
  limit: 20,
  stale_after_seconds: 20,
})
const flush = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}
beforeEach(() => {
  vi.useFakeTimers()
  mounted.length = 0
  auth.canManageProjects = true
  vi.mocked(auth.revokeManagement).mockClear()
  doc = Object.assign(new EventTarget(), { hidden: false })
  win = new EventTarget()
  network = { onLine: true }
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', network)
  vi.mocked(api.request).mockImplementation(async (path) =>
    path.includes('/summary') ? { snapshot: { instance_id: 'api' } } : rows(),
  )
  scope = effectScope()
})
afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})
function start() {
  const result = scope.run(useOperations)!
  mounted.forEach((fn) => fn())
  return result
}
it('retains unknown, valid zero, failed and old measurement semantics', () => {
  expect(number(null)).toBe('未采集')
  expect(number(0)).toBe('0')
  const s = { sampled_at: new Date(0).toISOString(), stale_after_seconds: 20, error: null }
  expect(freshness(null, 100)).toBe('未采集')
  expect(freshness(s, 19000)).toBe('快照有效')
  expect(freshness(s, 21000)).toBe('已过期')
  expect(freshness({ ...s, error: 'failed' }, 1000)).toBe('已过期')
})
it('coalesces identical in-flight refreshes and stops reads while hidden or offline', async () => {
  const o = start()
  const current = o.load()
  expect(o.load()).toBe(current)
  expect(api.request).toHaveBeenCalledTimes(2)
  await flush()
  doc.hidden = true
  doc.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(16000)
  expect(api.request).toHaveBeenCalledTimes(2)
  doc.hidden = false
  doc.dispatchEvent(new Event('visibilitychange'))
  await flush()
  expect(api.request).toHaveBeenCalledTimes(4)
  network.onLine = false
  win.dispatchEvent(new Event('offline'))
  await vi.advanceTimersByTimeAsync(16000)
  expect(api.request).toHaveBeenCalledTimes(4)
  network.onLine = true
  win.dispatchEvent(new Event('online'))
  await flush()
  expect(api.request).toHaveBeenCalledTimes(6)
})
it('does not let a late first filter overwrite a newer project or state', async () => {
  let resolveOld!: (value: unknown) => void
  vi.mocked(api.request).mockImplementation((path) =>
    path.includes('/summary')
      ? Promise.resolve({ snapshot: { instance_id: 'api' } })
      : path.includes('project=new')
        ? Promise.resolve(rows('new-task', 'new', 'waiting'))
        : new Promise((resolve) => {
            resolveOld = resolve
          }),
  )
  const o = start()
  o.project.value = 'new'
  o.state.value = 'waiting'
  await flush()
  await flush()
  expect(o.tasks.value?.page.items[0]?.id).toBe('new-task')
  resolveOld(rows('old-task'))
  await flush()
  expect(o.tasks.value?.page.items[0]?.id).toBe('new-task')
})
it('clears retained privileged data and cancels polling when access is lost', async () => {
  const o = start()
  await flush()
  expect(o.summary.value?.instance_id).toBe('api')
  vi.mocked(api.request).mockRejectedValue(new ApiError('hidden', 'http', 404))
  await o.load()
  expect(auth.revokeManagement).toHaveBeenCalledTimes(1)
  expect(o.summary.value).toBeNull()
  expect(o.tasks.value).toBeNull()
  const count = vi.mocked(api.request).mock.calls.length
  await vi.advanceTimersByTimeAsync(15000)
  expect(api.request).toHaveBeenCalledTimes(count)
})
it('uses the returned stable cursor and resets it on a filter change', async () => {
  vi.mocked(api.request).mockImplementation(async (path) =>
    path.includes('/summary')
      ? { snapshot: { instance_id: 'api' } }
      : {
          ...rows(),
          page: { ...rows().page, next: { id: 'cursor-task', created_at: '2026-10-13T00:00:00Z' } },
        },
  )
  const o = start()
  await flush()
  o.changePage(1)
  await flush()
  expect(
    vi.mocked(api.request).mock.calls.some(([path]) => path.includes('before_id=cursor-task')),
  ).toBe(true)
  o.state.value = 'done'
  await flush()
  expect(o.page.value).toBe(1)
  expect(vi.mocked(api.request).mock.calls.at(-1)?.[0]).not.toContain('before_id')
})
it.each(['tasks', 'summary'] as const)(
  'updates the healthy channel when only %s fails, initially and after data exists',
  async (failed) => {
    let broken = true,
      sequence = 0
    vi.mocked(api.request).mockImplementation(async (path) => {
      const channel = path.includes('/summary') ? 'summary' : 'tasks'
      if (channel === failed && broken) throw new ApiError('isolated', 'http', 503)
      const n = ++sequence
      return channel === 'summary' ? { snapshot: { instance_id: `api-${n}` } } : rows(`task-${n}`)
    })
    const o = start()
    await flush()
    const healthy = () =>
      failed === 'tasks' ? o.summary.value?.instance_id : o.tasks.value?.page.items[0]?.id
    const failure = () => (failed === 'tasks' ? o.tasksError.value : o.summaryError.value)
    expect(healthy()).toBeTruthy()
    expect(failure()).toBeTruthy()
    const first = healthy()
    await vi.advanceTimersByTimeAsync(5000)
    expect(healthy()).not.toBe(first)
    broken = false
    await o.load()
    expect(o.tasks.value).not.toBeNull()
    expect(o.summary.value).not.toBeNull()
    expect(failure()).toBe('')
    const retained = failed === 'tasks' ? o.tasks.value : o.summary.value
    broken = true
    await o.load()
    const before = healthy()
    await vi.advanceTimersByTimeAsync(25000)
    expect(healthy()).not.toBe(before)
    expect(failed === 'tasks' ? o.tasks.value : o.summary.value).toBe(retained)
    expect(failure()).toBeTruthy()
  },
)
it('keeps summary polling while a tasks request is still pending and reuses that pending read', async () => {
  let finish!: (value: unknown) => void,
    summaryCount = 0,
    tasksCount = 0
  vi.mocked(api.request).mockImplementation((path) => {
    if (path.includes('/summary'))
      return Promise.resolve({ snapshot: { instance_id: `api-${++summaryCount}` } })
    tasksCount++
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  const o = start()
  await flush()
  await vi.advanceTimersByTimeAsync(15000)
  expect(tasksCount).toBe(1)
  expect(summaryCount).toBe(4)
  expect(o.summary.value?.instance_id).toBe('api-4')
  finish(rows())
  await flush()
  expect(o.tasks.value?.page.items[0]?.id).toBe('task')
})
it('rejects both late channel results after either channel revokes permission', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.request).mockImplementation((path) =>
    path.includes('/summary')
      ? new Promise((resolve) => {
          finish = resolve
        })
      : Promise.reject(new ApiError('hidden', 'http', 404)),
  )
  const o = start()
  await flush()
  expect(auth.canManageProjects).toBe(false)
  finish({ snapshot: { instance_id: 'must-not-return' } })
  await flush()
  expect(o.summary.value).toBeNull()
  expect(o.tasks.value).toBeNull()
  await vi.advanceTimersByTimeAsync(15000)
  expect(api.request).toHaveBeenCalledTimes(2)
})

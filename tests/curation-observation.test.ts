import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { api, ApiError } from '@/api'
import * as session from '@/api/session'
import * as source from '@/features/curation/source'
import * as knowledge from '@/contracts/knowledge/source'
import { useCurationPanel } from '@/features/curation/useCurationPanel'
import { useCurationReview } from '@/features/curation/useCurationReview'
import { useReviewProgress } from '@/features/curation/useReviewProgress'
import { useDocumentCuration } from '@/features/documents/useDocumentCuration'
import { documentRequests } from '@/features/documents/documentRequests'
import { changeCuration } from '@/contracts/knowledge/curationReads'
import type { CurateProgress } from '@/contracts/knowledge/types'

vi.mock('@/features/projects/source', () => ({
  projectSource: { get: async () => ({ project_id: 'p' }) },
}))

const scopes: ReturnType<typeof effectScope>[] = []
let page: EventTarget & { hidden: boolean }
let token: string
const running: CurateProgress = {
  status: 'running',
  stage: 'fields',
  candidate_id: 'c',
  run_id: 'r',
  total: 2,
  completed: 0,
  generated: 0,
  unchanged: 0,
  fields_updated: 0,
  message: null,
}
const row = (state = 'ready') => ({
  id: 'c',
  project_id: 'p',
  state,
  target: null,
  progress: running,
  updated_at: state,
})
function mount<T>(create: () => T) {
  const scope = effectScope()
  scopes.push(scope)
  return { scope, state: scope.run(create)! }
}
const deferred = <T>() => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const flush = () => vi.advanceTimersByTimeAsync(0)
function hidden(value: boolean) {
  page.hidden = value
  page.dispatchEvent(new Event('visibilitychange'))
}
beforeEach(() => {
  vi.useFakeTimers()
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
  token = 'synthetic-one'
  vi.spyOn(session, 'readCredential').mockImplementation(() => ({ token, expiresAt: '2099-01-01' }))
})
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('shares identical reads but isolates full parameters, project, token and run identity', async () => {
  const response = deferred<never>()
  const request = vi.spyOn(api, 'request').mockReturnValue(response.promise)
  const old = source.panelCandidates('p').catch((e) => e)
  const same = source.panelCandidates('p').catch((e) => e)
  const selected = source.panelCandidates('p', undefined, 'different').catch((e) => e)
  const other = source.panelCandidates('other').catch((e) => e)
  const runA = knowledge.curateProgress('p', undefined, 'r1').catch((e) => e)
  const runB = knowledge.curateProgress('p', undefined, 'r2').catch((e) => e)
  expect(request).toHaveBeenCalledTimes(5)
  token = 'synthetic-two'
  const next = source.panelCandidates('p')
  expect(request).toHaveBeenCalledTimes(6)
  response.resolve([] as never)
  expect(await old).toBeInstanceOf(ApiError)
  expect(await same).toBeInstanceOf(ApiError)
  await Promise.all([selected, other, runA, runB])
  expect(await next).toEqual([])
  await source.panelCandidates('p')
  expect(request).toHaveBeenCalledTimes(7) // no completed-result cache
})
it('one consumer can cancel without aborting another; the last consumer releases transport', async () => {
  const response = deferred<never>()
  const request = vi.spyOn(api, 'request').mockReturnValue(response.promise)
  const a = new AbortController(),
    b = new AbortController()
  const first = source.candidates('p', a.signal).catch((e) => e)
  const second = source.candidates('p', b.signal)
  const transport = request.mock.calls[0]![1]!.signal!
  a.abort()
  expect(transport.aborted).toBe(false)
  response.resolve([] as never)
  await first
  expect(await second).toEqual([])
  const c = new AbortController()
  const third = source.candidates('p', c.signal).catch((e) => e)
  c.abort()
  expect(request.mock.calls[1]![1]!.signal!.aborted).toBe(true)
  await third
})
it('fences responses from before a write and retries failures without caching them', async () => {
  const response = deferred<never>()
  const request = vi
    .spyOn(api, 'request')
    .mockReturnValueOnce(response.promise)
    .mockResolvedValue([])
  const old = source.candidates('p').catch((e) => e)
  await changeCuration('p', async () => {})
  response.resolve([row()] as never)
  expect(await old).toBeInstanceOf(ApiError)
  expect(await source.candidates('p')).toEqual([])
  request.mockRejectedValueOnce(new ApiError('offline', 'network'))
  await expect(source.candidates('p')).rejects.toThrow('offline')
  expect(await source.candidates('p')).toEqual([])
})
it('discovers another user within 30s, finishes polling at idle cadence, and refreshes after own actions', async () => {
  let rows: unknown[] = []
  const request = vi.spyOn(api, 'request').mockImplementation(async () => rows as never)
  const live = ref<CurateProgress | null>(null),
    busy = ref(false),
    key = ref('')
  const f = mount(() =>
    useCurationPanel(
      () => 'p',
      () => 'page',
      () => live.value,
      () => busy.value,
      vi.fn(),
      () => key.value,
    ),
  )
  await flush()
  rows = [row('running')]
  await vi.advanceTimersByTimeAsync(29999)
  expect(f.state.preferred.value).toBeNull()
  await vi.advanceTimersByTimeAsync(1)
  expect(f.state.projectRunning.value).toBe(true)
  rows = [row('ready')]
  await vi.advanceTimersByTimeAsync(5000)
  expect(f.state.projectRunning.value).toBe(false)
  const count = request.mock.calls.length
  await vi.advanceTimersByTimeAsync(29999)
  expect(request).toHaveBeenCalledTimes(count)
  await changeCuration('p', async () => {})
  await flush()
  expect(request).toHaveBeenCalledTimes(count + 1)
  live.value = running
  busy.value = true
  key.value = 'r'
  await nextTick()
  await flush()
  expect(request).toHaveBeenCalledTimes(count + 2) // batched local reactive changes
  hidden(true)
  await vi.advanceTimersByTimeAsync(300000)
  expect(request).toHaveBeenCalledTimes(count + 2)
  hidden(false)
  await flush()
  expect(request).toHaveBeenCalledTimes(count + 3)
})
it.each([401, 403])(
  'stops automatic candidate reads on %s, preserving explicit retry',
  async (status) => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValue(new ApiError('denied', 'http', status))
    const unauthorized = vi.fn()
    const f = mount(() =>
      useCurationPanel(
        () => 'p',
        () => 'page',
        () => null,
        () => false,
        unauthorized,
      ),
    )
    await flush()
    hidden(true)
    hidden(false)
    await vi.advanceTimersByTimeAsync(300000)
    expect(request).toHaveBeenCalledTimes(1)
    expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
    request.mockResolvedValue([])
    await f.state.refresh()
    expect(f.state.error.value).toBe('')
  },
)
it('retries reads on online, ignores blur, and never interprets a heartbeat as work progress', async () => {
  const request = vi
    .spyOn(api, 'request')
    .mockRejectedValueOnce(new ApiError('offline', 'network'))
    .mockResolvedValue(running)
  const f = mount(() => useReviewProgress(() => 'p', vi.fn()))
  void f.state.observe(running)
  await flush()
  expect(f.state.error.value).toContain('重新连接')
  window.dispatchEvent(new Event('online'))
  await flush()
  expect(request).toHaveBeenCalledTimes(2)
  window.dispatchEvent(new Event('blur'))
  await vi.advanceTimersByTimeAsync(2000)
  expect(request).toHaveBeenCalledTimes(3)
  expect(f.state.progress.value?.completed).toBe(0)
  hidden(true)
  await vi.advanceTimersByTimeAsync(300000)
  expect(request).toHaveBeenCalledTimes(3)
  request.mockResolvedValue({ ...running, status: 'done' })
  hidden(false)
  await flush()
  expect(f.state.busy.value).toBe(false)
  await vi.advanceTimersByTimeAsync(60000)
  expect(request).toHaveBeenCalledTimes(4)
})
it('document and review consumers share an overlapping read of the same run', async () => {
  const request = vi.spyOn(api, 'request').mockImplementation(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25))
    return running as never
  })
  const requests = documentRequests(() => 'p')
  const workspace = {
    canStart: () => true,
    selectedId: () => '',
    setIndex: vi.fn(),
    refreshDetail: vi.fn(),
  }
  const doc = useDocumentCuration(() => 'p', requests, vi.fn(), workspace)
  const review = mount(() => useReviewProgress(() => 'p', vi.fn()))
  void doc.viewProgress(running)
  await vi.advanceTimersByTimeAsync(2000)
  void review.state.observe(running)
  await flush()
  expect(request).toHaveBeenCalledTimes(1)
  requests.cancelAll()
  await vi.advanceTimersByTimeAsync(25)
  expect(review.state.progress.value?.run_id).toBe('r')
})
it('review history preserves lifecycle refresh, pauses hidden, and detects another run while idle', async () => {
  let rows: unknown[] = [],
    version = 1
  const request = vi.spyOn(api, 'request').mockImplementation(async (path) => {
    if (path.endsWith('/candidates')) return rows as never
    if (path.endsWith('/document-lifecycle'))
      return { version, reconciled_version: version, decisions: [] } as never
    return {} as never
  })
  const f = mount(() =>
    useCurationReview(
      () => 'p',
      () => '',
      vi.fn(),
    ),
  )
  await flush()
  hidden(true)
  const count = request.mock.calls.length
  await vi.advanceTimersByTimeAsync(300000)
  expect(request).toHaveBeenCalledTimes(count)
  rows = [row('running')]
  version++
  hidden(false)
  await flush()
  expect(f.state.list.value[0]?.state).toBe('running')
  expect(request.mock.calls.some(([p]) => p.endsWith('/document-lifecycle'))).toBe(true)
  const current = request.mock.calls.length
  await vi.advanceTimersByTimeAsync(2500)
  expect(request).toHaveBeenCalledTimes(current + 2)
})
it('review refreshes a candidate lifecycle overlay on return and discovers new runs at idle cadence', async () => {
  let version = 1
  let state = 'ready'
  vi.spyOn(api, 'request').mockImplementation(async (path) => {
    if (path.endsWith('/candidates')) return [row(state)] as never
    if (path.endsWith('/candidates/c')) return row(state) as never
    if (path.endsWith('/endpoints')) return { endpoints: [] } as never
    return { version, reconciled_version: version, decisions: [] } as never
  })
  const f = mount(() =>
    useCurationReview(
      () => 'p',
      () => 'c',
      vi.fn(),
    ),
  )
  await flush()
  expect(f.state.index.value?.lifecycle?.version).toBe(1)
  hidden(true)
  version = 2
  await vi.advanceTimersByTimeAsync(300000)
  expect(f.state.index.value?.lifecycle?.version).toBe(1)
  hidden(false)
  await flush()
  expect(f.state.index.value?.lifecycle?.version).toBe(2)
  state = 'running'
  await vi.advanceTimersByTimeAsync(30000)
  expect(f.state.candidate.value?.state).toBe('running')
})
it('does not begin hidden review reads, and releases a hidden waiter on disposal', async () => {
  hidden(true)
  const request = vi.spyOn(api, 'request').mockResolvedValue([])
  const f = mount(() =>
    useCurationReview(
      () => 'p',
      () => '',
      vi.fn(),
    ),
  )
  await vi.advanceTimersByTimeAsync(300000)
  expect(request).not.toHaveBeenCalled()
  f.scope.stop()
  hidden(false)
  await flush()
  expect(request).not.toHaveBeenCalled()
})
it('project switch releases a hidden progress waiter and a new round cannot receive the old result', async () => {
  const pid = ref('p')
  const old = deferred<never>()
  const request = vi
    .spyOn(api, 'request')
    .mockReturnValueOnce(old.promise)
    .mockResolvedValue({ ...running, run_id: 'new' })
  const f = mount(() => useReviewProgress(() => pid.value, vi.fn()))
  const first = f.state.observe(running)
  await flush()
  const next = f.state.observe({ ...running, run_id: 'new' })
  await flush()
  old.resolve({ ...running, completed: 99 } as never)
  await first
  expect(f.state.progress.value?.run_id).toBe('new')
  expect(f.state.progress.value?.completed).toBe(0)
  hidden(true)
  pid.value = 'q'
  await nextTick()
  await next
  hidden(false)
  await flush()
  expect(request).toHaveBeenCalledTimes(2)
  expect(f.state.progress.value).toBeNull()
  expect(f.state.busy.value).toBe(false)
})

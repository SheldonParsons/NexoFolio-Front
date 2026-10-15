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
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((r, fail) => {
    resolve = r
    reject = fail
  })
  return { promise, resolve, reject }
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
    if (path.includes('/candidates/c/review'))
      return { ...row(state), version: 0, history_available: true } as never
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

it('pauses uncertain-write reconciliation while hidden and checks the saved state on return', async () => {
  const snapshot = { endpoints: [], folders: [], placements: [], notes: [], fields: [], links: [] }
  const status = {
    ...row(),
    version: 0,
    history_available: true,
    resume_available: false,
    applied_rounds: [],
  }
  vi.spyOn(source, 'reviewCandidate').mockResolvedValue({
    ...status,
    base: snapshot,
    view: snapshot,
    batches: [],
    parent: null,
    base_hash: '',
    reviewed_by: null,
  } as never)
  vi.spyOn(source, 'candidates').mockResolvedValue([row()] as never)
  vi.spyOn(source, 'reviewStatus').mockResolvedValue(status as never)
  vi.spyOn(api, 'request').mockResolvedValue({ version: 0, reconciled_version: 0, decisions: [] })
  const post = vi
    .spyOn(source, 'applyCandidate')
    .mockRejectedValue(new ApiError('timeout', 'timeout'))
  const read = vi
    .spyOn(source, 'applyStatus')
    .mockResolvedValue({
      candidate: status,
      operation: 'fixture',
      progress: { stage: 'writing', processed: 1, total: 2 },
    } as never)
  const f = mount(() =>
    useCurationReview(
      () => 'p',
      () => 'c',
      vi.fn(),
    ),
  )
  await flush()
  const decision = f.state.decide('apply', 'c')
  hidden(true)
  await flush()
  const count = read.mock.calls.length
  await vi.advanceTimersByTimeAsync(5000)
  expect(read).toHaveBeenCalledTimes(count)
  read.mockResolvedValue({
    candidate: { ...status, state: 'applied' },
    operation: 'fixture',
    progress: null,
  } as never)
  vi.mocked(source.reviewStatus).mockResolvedValue({ ...status, state: 'applied' } as never)
  hidden(false)
  await flush()
  await expect(decision).resolves.toBe(true)
  expect(post).toHaveBeenCalledTimes(1)
})

// Only the API boundary is delayed. Keep source.applyStatus/applyCandidate and
// readCuration/changeCuration real, including shared reads and write-version fences.
function decisionTransport() {
  const pid = ref('p'),
    cid = ref('c')
  const observer = deferred<unknown>(),
    reconciliation = deferred<unknown>(),
    post = deferred<unknown>()
  const reads: Array<{ path: string; signal?: AbortSignal | null }> = []
  let posts = 0
  const status = (stage: string | null, state = 'ready') => ({
    candidate: {
      ...row(state),
      version: 0,
      history_available: true,
      resume_available: false,
      applied_rounds: [],
    },
    operation: null,
    progress: stage ? { stage, processed: 2, total: 2 } : null,
  })
  vi.spyOn(api, 'request').mockImplementation((path, options) => {
    if (path.includes('/apply-status?')) {
      reads.push({ path, signal: options?.signal })
      return (reads.length === 1 ? observer.promise : reconciliation.promise) as never
    }
    if (path.includes('/apply?')) {
      expect(options?.method).toBe('POST')
      posts++
      return post.promise as never
    }
    const parts = path.split('?')[0]!.split('/')
    const summary = { ...row(), id: parts[5] ?? 'c', project_id: parts[2], progress: {} }
    if (path.endsWith('/candidates')) return Promise.resolve([summary]) as never
    if (path.includes('/document-lifecycle'))
      return Promise.resolve({ version: 0, reconciled_version: 0, decisions: [] }) as never
    if (path.includes('/review')) {
      const snapshot = {
        endpoints: [],
        folders: [],
        placements: [],
        notes: [],
        fields: [],
        links: [],
      }
      return Promise.resolve({
        ...status(null).candidate,
        ...summary,
        base: snapshot,
        view: snapshot,
        batches: [],
      }) as never
    }
    throw new Error(`Unexpected API request: ${path}`)
  })
  const f = mount(() =>
    useCurationReview(
      () => pid.value,
      () => cid.value,
      vi.fn(),
    ),
  )
  return { ...f, pid, cid, observer, reconciliation, post, reads, status, posts: () => posts }
}

it.each([
  ['failed', 'after decision'],
  ['unknown', 'after decision'],
  ['unavailable', 'after decision'],
  ['failed', 'during reconciliation'],
  ['unknown', 'during reconciliation'],
  ['unavailable', 'during reconciliation'],
])('ends actual-transport observation after %s, with a late reply %s', async (outcome, timing) => {
  const f = decisionTransport()
  await flush()
  const decision = f.state.decide('apply', 'c')
  f.post.reject(new ApiError('candidate rejected', 'http', 409))
  await flush()
  expect(f.reads).toHaveLength(2)
  expect(f.reads[0]!.path).toBe(f.reads[1]!.path)
  expect(f.reads[0]!.signal).not.toBe(f.reads[1]!.signal) // A new transport after the write fence.
  if (timing === 'during reconciliation') {
    f.observer.resolve(f.status('waiting', 'applied'))
    await vi.advanceTimersByTimeAsync(1800)
    expect(f.state.deciding.value).toBe(true)
    expect(f.reads).toHaveLength(2)
  }
  if (outcome === 'unavailable') f.reconciliation.reject(new ApiError('status offline', 'network'))
  else f.reconciliation.resolve(f.status(outcome!))
  await expect(decision).resolves.toBe(false)
  expect(f.state.deciding.value).toBe(false)
  expect(f.state.candidate.value?.state).toBe('ready')
  const message = f.state.decisionStatus.value,
    error = f.state.error.value
  expect(message).toContain(outcome === 'failed' ? '服务器未应用' : '尚未确认')
  f.observer.resolve(f.status('waiting', 'applied'))
  await vi.advanceTimersByTimeAsync(1800)
  expect(f.reads).toHaveLength(2)
  expect(f.posts()).toBe(1)
  expect(f.state.candidate.value?.state).toBe('ready')
  expect(f.state.decisionStatus.value).toBe(message)
  expect(f.state.error.value).toBe(error)
})

it.each(['candidate switch', 'project switch', 'unmount'])(
  'invalidates late progress and write replies on %s with real transport fencing',
  async (exit) => {
    const f = decisionTransport()
    await flush()
    const decision = f.state.decide('apply', 'c')
    expect(f.reads).toHaveLength(1)
    if (exit === 'unmount') f.scope.stop()
    else if (exit === 'project switch') f.pid.value = 'q'
    else f.cid.value = 'next'
    await flush()
    expect(f.reads[0]!.signal?.aborted).toBe(true)
    const id = f.state.candidate.value?.id,
      project = f.state.candidate.value?.project_id
    const message = f.state.decisionStatus.value,
      error = f.state.error.value
    f.post.reject(new ApiError('late failure', 'network'))
    f.observer.resolve(f.status('committed', 'applied'))
    await expect(decision).resolves.toBe(false)
    await vi.advanceTimersByTimeAsync(1800)
    expect(f.reads).toHaveLength(1)
    expect(f.posts()).toBe(1)
    expect(f.state.candidate.value?.id).toBe(id)
    expect(f.state.candidate.value?.project_id).toBe(project)
    expect(f.state.candidate.value?.state).toBe('ready')
    expect(f.state.decisionStatus.value).toBe(message)
    expect(f.state.error.value).toBe(error)
  },
)

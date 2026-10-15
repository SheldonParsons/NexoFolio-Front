import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import * as knowledge from '@/contracts/knowledge/source'
import { useDocumentCuration } from '@/features/documents/useDocumentCuration'
import { documentRequests } from '@/features/documents/documentRequests'
import type { CurateProgress } from '@/contracts/knowledge/types'
const requests: ReturnType<typeof documentRequests>[] = []
afterEach(() => {
  requests.splice(0).forEach((r) => r.cancelAll())
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const job = (task_id: string, target: string | null = null): CurateProgress => ({
  task_id,
  target,
  status: 'running',
  task_state: 'queued',
  candidate_id: null,
  run_id: null,
  stage: null,
  completed: 0,
  total: 0,
  generated: 0,
  unchanged: 0,
  message: null,
})
function fixture() {
  const req = documentRequests(() => 'p')
  requests.push(req)
  return useDocumentCuration(
    () => 'p',
    req,
    (error, target) => {
      target.value = String(error)
    },
    { canStart: () => true, selectedId: () => '', setIndex: vi.fn(), refreshDetail: vi.fn() },
  )
}
it('allows another scope while watching a run, but coalesces clicks until the admission returns', async () => {
  vi.useFakeTimers()
  vi.spyOn(knowledge, 'curateProgress').mockImplementation(
    (_p, signal) =>
      new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      ),
  )
  let accept!: (p: CurateProgress) => void
  const start = vi
    .spyOn(knowledge, 'startCurate')
    .mockImplementation(() => new Promise((resolve) => (accept = resolve)))
  const f = fixture()
  void f.viewProgress({ ...job('A', 'endpoint-a'), candidate_id: 'ca' })
  const submission = f.organize()
  expect(start).toHaveBeenCalledTimes(1)
  expect(f.progress.value?.task_id).toBe('A')
  void f.organize()
  expect(start).toHaveBeenCalledTimes(1)
  accept(job('B'))
  await vi.advanceTimersByTimeAsync(0)
  expect(f.progress.value?.task_id).toBe('B')
  requests[0]!.cancelAll()
  await vi.advanceTimersByTimeAsync(2000)
  await submission
})
it('a duplicate accepted task keeps its existing observation and progress', async () => {
  vi.useFakeTimers()
  const a = {
    ...job('A'),
    run_id: 'owner',
    candidate_id: 'candidate',
    task_state: 'running' as const,
    completed: 7,
  }
  const read = vi.spyOn(knowledge, 'curateProgress').mockImplementation(() => new Promise(() => {}))
  const post = vi.spyOn(knowledge, 'startCurate').mockResolvedValue({ ...a, completed: 0 })
  const f = fixture()
  void f.viewProgress(a)
  await f.organize()
  expect(post).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(0) // observation waits before its first poll
  expect(f.progress.value?.completed).toBe(7)
})
it('an uncertain submission finds the accepted scope without replaying its POST or adopting the selected task', async () => {
  vi.useFakeTimers()
  const a = { ...job('A', 'endpoint-a'), candidate_id: 'ca' },
    b = job('B')
  vi.spyOn(knowledge, 'startCurate').mockRejectedValue(new ApiError('timeout', 'timeout'))
  vi.spyOn(knowledge, 'curateProgress').mockImplementation(async (_p, _s, key) =>
    key === 'task:B' ? b : a,
  )
  vi.spyOn(knowledge, 'activeCurationTasks').mockResolvedValue([
    { id: 'B', project_id: 'p', target: null, candidate_id: null, state: 'queued', created_at: '' },
  ])
  const f = fixture()
  void f.viewProgress(a)
  const submitting = f.organize()
  await vi.advanceTimersByTimeAsync(0)
  expect(f.progress.value?.task_id).toBe('B')
  expect(knowledge.startCurate).toHaveBeenCalledTimes(1)
  requests[0]!.cancelAll()
  await vi.advanceTimersByTimeAsync(2000)
  await submitting
})
it('an unconfirmed other scope leaves the original task available and observed', async () => {
  vi.useFakeTimers()
  const a = { ...job('A', 'endpoint-a'), candidate_id: 'ca' }
  vi.spyOn(knowledge, 'startCurate').mockRejectedValue(new ApiError('timeout', 'timeout'))
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue(a)
  vi.spyOn(knowledge, 'activeCurationTasks').mockResolvedValue([])
  const f = fixture()
  void f.viewProgress(a)
  await f.organize()
  expect(f.progress.value?.task_id).toBe('A')
  expect(f.busy.value).toBe(true)
  expect(f.noticeError.value).toBe(true)
  expect(f.submitting.value).toBe(false)
  expect(knowledge.startCurate).toHaveBeenCalledTimes(1)
})

it('treats an explicitly stopped queue task as a normal result, without replacing its identity', async () => {
  const f = fixture()
  await f.viewProgress({ ...job('stopped'), status: 'failed', task_state: 'stopped' })
  expect(f.noticeError.value).toBe(false)
  expect(f.notice.value).toBe('排队已取消')
  expect(f.progress.value?.task_id).toBe('stopped')
})

it('a late stop failure remains scoped to the task that was selected when stopping', async () => {
  vi.useFakeTimers()
  let fail!: (error: unknown) => void
  const stop = vi
    .spyOn(knowledge, 'stopCurationTask')
    .mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)))
  const f = fixture()
  void f.viewProgress(job('A'))
  const pending = f.cancel('A')
  void f.viewProgress(job('B'))
  fail(new Error('old stop failed'))
  await pending
  expect(stop).toHaveBeenCalledWith('p', 'A', expect.any(AbortSignal))
  expect(f.progress.value?.task_id).toBe('B')
  expect(f.noticeError.value).toBe(false)
})

it('stopping a needs-attention task refreshes its durable state even after observation ended', async () => {
  const attention: CurateProgress = {
    ...job('A'),
    status: 'failed',
    task_state: 'needs_attention',
    candidate_id: 'ca',
    message: '需要处理',
  }
  const stop = vi.spyOn(knowledge, 'stopCurationTask').mockResolvedValue(undefined)
  const read = vi
    .spyOn(knowledge, 'curateProgress')
    .mockResolvedValue({ ...attention, task_state: 'stopped', message: '用户已停止任务' })
  const f = fixture()
  await f.viewProgress(attention)
  expect(f.busy.value).toBe(false)
  await f.cancel('A')
  expect(stop).toHaveBeenCalledWith('p', 'A', expect.any(AbortSignal))
  expect(read).toHaveBeenCalledWith('p', expect.any(AbortSignal), 'task:A')
  expect(f.progress.value?.task_state).toBe('stopped')
  expect(f.noticeError.value).toBe(false)
})

it('stops a persisted task selected by the panel before an observer is attached', async () => {
  const selected: CurateProgress = {
    ...job('persisted'),
    status: 'failed',
    task_state: 'needs_attention',
    candidate_id: 'saved',
  }
  const stop = vi.spyOn(knowledge, 'stopCurationTask').mockResolvedValue(undefined)
  const cancel = vi.spyOn(knowledge, 'cancelCandidate').mockResolvedValue(undefined)
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue({ ...selected, task_state: 'stopped' })
  const f = fixture()
  await f.cancel('persisted', selected)
  expect(stop).toHaveBeenCalledWith('p', 'persisted', expect.any(AbortSignal))
  expect(cancel).not.toHaveBeenCalled()
  expect(f.progress.value?.task_state).toBe('stopped')
})

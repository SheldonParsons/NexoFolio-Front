import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import * as source from '@/contracts/knowledge/source'
import { ApiError } from '@/api'
import { useReviewProgress } from '@/features/curation/useReviewProgress'
import { usePanelSize } from '@/features/curation/usePanelSize'
import type { CurateProgress } from '@/contracts/knowledge/types'
vi.mock('@/contracts/knowledge/source', () => ({
  curateProgress: vi.fn(),
  resumeCandidate: vi.fn(),
  cancelCandidate: vi.fn(),
  startCurate: vi.fn(),
}))
const scopes: ReturnType<typeof effectScope>[] = []
const job = (extra: Partial<CurateProgress> = {}): CurateProgress => ({
  status: 'running',
  candidate_id: 'current',
  run_id: 'attempt',
  candidate_state: 'running',
  stage: 'fields',
  completed: 63,
  total: 63,
  generated: 3,
  unchanged: 60,
  fields_updated: 12,
  message: null,
  ...extra,
})
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.resetAllMocks()
})
function fixture() {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useReviewProgress(() => 'p', vi.fn()))!
  return { scope, state }
}
it('observes the current run and keeps reading live progress without starting or resuming it', async () => {
  vi.mocked(source.curateProgress)
    .mockResolvedValueOnce(job({ fields_updated: 13 }))
    .mockResolvedValueOnce(job({ status: 'done', candidate_state: 'ready', fields_updated: 24 }))
  const f = fixture()
  const observation = f.state.observe(job())
  await vi.advanceTimersByTimeAsync(0)
  expect(f.state.progress.value?.fields_updated).toBe(13)
  await vi.advanceTimersByTimeAsync(2000)
  await observation
  expect(f.state.progress.value?.fields_updated).toBe(24)
  expect(f.state.busy.value).toBe(false)
  expect(source.startCurate).not.toHaveBeenCalled()
  expect(source.resumeCandidate).not.toHaveBeenCalled()
  expect(source.cancelCandidate).not.toHaveBeenCalled()
})
it('closing the page aborts its read and ignores late progress without stopping the backend', async () => {
  let finish!: (p: CurateProgress) => void
  vi.mocked(source.curateProgress).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const f = fixture()
  const observation = f.state.observe(job())
  const signal = vi.mocked(source.curateProgress).mock.calls[0]![1]!
  f.scope.stop()
  finish(job({ fields_updated: 100 }))
  await observation
  expect(signal.aborted).toBe(true)
  expect(f.state.progress.value?.fields_updated).toBe(12)
  expect(source.cancelCandidate).not.toHaveBeenCalled()
})
it('does not silently resume a task on access failure', async () => {
  vi.mocked(source.curateProgress).mockRejectedValue(new ApiError('forbidden', 'http', 403))
  const f = fixture()
  await f.state.observe(job())
  expect(f.state.blocked.value).toBe(true)
  expect(source.resumeCandidate).not.toHaveBeenCalled()
})
it('can reconnect after an explicit retry without changing the backend task', async () => {
  vi.mocked(source.curateProgress)
    .mockRejectedValueOnce(new ApiError('forbidden', 'http', 403))
    .mockResolvedValueOnce(job({ status: 'done', candidate_state: 'ready' }))
  const f = fixture()
  await f.state.observe(job())
  expect(f.state.blocked.value).toBe(true)
  await f.state.observe(job())
  expect(f.state.blocked.value).toBe(false)
  expect(f.state.error.value).toBe('')
  expect(source.resumeCandidate).not.toHaveBeenCalled()
  expect(source.cancelCandidate).not.toHaveBeenCalled()
})
it('an explicit full-size reveal does not overwrite the saved display size', () => {
  const a = effectScope()
  scopes.push(a)
  const remembered = a.run(() => usePanelSize())!
  remembered.setSize('mini')
  const b = effectScope()
  scopes.push(b)
  const revealed = b.run(() => usePanelSize(() => false, 'full'))!
  expect(revealed.size.value).toBe('full')
  expect(remembered.size.value).toBe('mini')
})

import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { usePendingCuration } from '@/features/curation/usePendingCuration'
import { useCurationReview } from '@/features/curation/useCurationReview'
import { canReviewDecision } from '@/features/curation/reviewActions'
import * as source from '@/features/curation/source'
import { projectSource } from '@/features/projects/source'
import { ApiError } from '@/api'
import type { Candidate, CandidateSummary, CandidateState } from '@/features/curation/types'
import type { Project } from '@/features/projects/types'
vi.mock('@/features/projects/source', () => ({ projectSource: { get: vi.fn() } }))

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.restoreAllMocks()
})
function summary(id: string, state: CandidateState = 'ready', pid = 'p'): CandidateSummary {
  return {
    id,
    project_id: pid,
    state,
    target: null,
    created_at: '2026-10-08T02:00:00Z',
    updated_at: '2026-10-08T02:00:00Z',
    commands: 1,
    progress: {},
  }
}
function candidate(id = 'c', state: CandidateState = 'ready'): Candidate {
  const { commands: _, ...value } = summary(id, state)
  const snapshot = { endpoints: [], folders: [], placements: [], notes: [], fields: [], links: [] }
  return {
    ...value,
    parent: null,
    base_hash: 'fixture',
    base: snapshot,
    view: snapshot,
    batches: [],
    applied_rounds: [],
    reviewed_by: null,
  }
}
function pendingFixture() {
  const open = ref(false),
    pid = ref('p'),
    unauthorized = vi.fn(),
    scope = effectScope()
  scopes.push(scope)
  const value = scope.run(() =>
    usePendingCuration(
      () => open.value,
      () => pid.value,
      unauthorized,
    ),
  )!
  return { open, pid, value, unauthorized }
}
it('reads pending guidance only when requested and never performs a review write', async () => {
  const read = vi
    .spyOn(source, 'candidates')
    .mockResolvedValue([
      summary('pending'),
      summary('partial', 'partial'),
      summary('applied', 'applied'),
      summary('foreign', 'ready', 'other'),
    ])
  const apply = vi
      .spyOn(source, 'applyCandidate')
      .mockResolvedValue({ status: 'applied', rounds: [] }),
    discard = vi.spyOn(source, 'discardCandidate').mockResolvedValue({ status: 'discarded' })
  const f = pendingFixture()
  expect(read).not.toHaveBeenCalled()
  expect(f.value.readyToStart.value).toBe(false)
  f.open.value = true
  await vi.waitFor(() => expect(f.value.readyToStart.value).toBe(true))
  expect(f.value.awaiting.value.map((v) => v.id)).toEqual(['pending', 'partial'])
  f.open.value = false
  await nextTick()
  expect(f.value.readyToStart.value).toBe(false)
  expect(apply).not.toHaveBeenCalled()
  expect(discard).not.toHaveBeenCalled()
})
it('blocks a new start when lookup fails or another generation is running', async () => {
  const read = vi
    .spyOn(source, 'candidates')
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue([summary('running', 'running')])
  const f = pendingFixture()
  f.open.value = true
  await vi.waitFor(() => expect(f.value.error.value).not.toBe(''))
  expect(f.value.readyToStart.value).toBe(false)
  await f.value.load()
  expect(read).toHaveBeenCalledTimes(2)
  expect(f.value.running.value?.id).toBe('running')
  expect(f.value.readyToStart.value).toBe(false)
})
it('ignores canceled and old-project replies instead of offering the wrong review link', async () => {
  let oldReply!: (value: CandidateSummary[]) => void
  vi.spyOn(source, 'candidates').mockImplementation((pid) =>
    pid === 'p'
      ? new Promise((resolve) => {
          oldReply = resolve
        })
      : Promise.resolve([summary('fresh', 'ready', 'q')]),
  )
  const f = pendingFixture()
  f.open.value = true
  await nextTick()
  f.pid.value = 'q'
  await vi.waitFor(() => expect(f.value.awaiting.value[0]?.id).toBe('fresh'))
  oldReply([summary('late')])
  await nextTick()
  expect(f.value.awaiting.value.map((v) => v.id)).toEqual(['fresh'])
  expect(f.value.readyToStart.value).toBe(true)
})
async function reviewFixture(state: CandidateState = 'ready') {
  const stored = candidate('c', state)
  const project: Project = {
    project_id: 'p',
    name: '测试项目',
    status: 'doing',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  }
  vi.spyOn(projectSource, 'get').mockResolvedValue(project)
  vi.spyOn(source, 'factsIndex').mockResolvedValue({
    catalog: { project_id: 'p', folders: [], unplaced: 0 },
    entries: [],
  })
  const list = vi.spyOn(source, 'candidates').mockResolvedValue([summary('c', state)])
  const detail = vi.spyOn(source, 'candidate').mockResolvedValue(stored)
  const scope = effectScope()
  scopes.push(scope)
  const value = scope.run(() =>
    useCurationReview(
      () => 'p',
      () => 'c',
      vi.fn(),
    ),
  )!
  await vi.waitFor(() => expect(value.candidate.value).not.toBeNull())
  return { value, list, detail }
}
it('rejects a confirmation for another candidate before sending a mutation', async () => {
  const apply = vi
      .spyOn(source, 'applyCandidate')
      .mockResolvedValue({ status: 'applied', rounds: [] }),
    discard = vi.spyOn(source, 'discardCandidate').mockResolvedValue({ status: 'discarded' })
  const { value } = await reviewFixture()
  expect(apply).not.toHaveBeenCalled()
  expect(discard).not.toHaveBeenCalled()
  await expect(value.decide('apply', 'another-candidate')).resolves.toBe(false)
  await expect(value.decide('discard', 'another-candidate')).resolves.toBe(false)
  expect(apply).not.toHaveBeenCalled()
  expect(discard).not.toHaveBeenCalled()
})
it('allows discarding an interrupted result but does not apply it', async () => {
  const apply = vi
    .spyOn(source, 'applyCandidate')
    .mockResolvedValue({ status: 'applied', rounds: [] })
  const { value } = await reviewFixture('interrupted')
  expect(canReviewDecision('interrupted', 'discard')).toBe(true)
  await expect(value.decide('apply', 'c')).resolves.toBe(false)
  expect(apply).not.toHaveBeenCalled()
})
it('reconciles an uncertain confirmed write once without replaying the POST', async () => {
  const apply = vi
    .spyOn(source, 'applyCandidate')
    .mockRejectedValue(new ApiError('timed out', 'timeout'))
  const { value, detail } = await reviewFixture()
  detail.mockResolvedValue(candidate('c', 'applied'))
  await expect(value.decide('apply', 'c')).resolves.toBe(true)
  expect(apply).toHaveBeenCalledTimes(1)
  expect(value.candidate.value?.state).toBe('applied')
  expect(value.deciding.value).toBe(false)
})

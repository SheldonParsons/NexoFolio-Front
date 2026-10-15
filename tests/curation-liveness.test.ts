import { expect, it } from 'vitest'
import { liveness } from '@/features/curation/liveness'
import { phaseProgress } from '@/features/curation/progress'
import { processingHeadline } from '@/features/curation/activity'
import type { CurateProgress } from '@/contracts/knowledge/types'

const now = Date.parse('2026-10-09T00:22:00Z')
const job: CurateProgress = {
  status: 'running',
  stage: 'describe',
  completed: 0,
  total: 63,
  generated: 0,
  unchanged: 0,
  message: null,
  started_at: '2026-10-09T00:15:08Z',
  updated_at: '2026-10-09T00:15:26Z',
}

it('warns about no progress even while the worker heartbeat is fresh', () => {
  const health = liveness({ ...job, heartbeat_at: new Date(now).toISOString() }, now)
  expect(health?.state).toBe('waiting')
  expect(health?.warning).toContain('超过 2 分钟没有新进展')
  expect(health?.progress).toBe('距上次进展 6 分 34 秒')
})

it('distinguishes stale heartbeats from long running model work', () => {
  const health = liveness({ ...job, heartbeat_at: '2026-10-09T00:20:59Z' }, now)
  expect(health?.state).toBe('stale')
  expect(health?.warning).toContain('无法确认运行状态')
})

it('does not invent heartbeat evidence for old servers, malformed timestamps or finished runs', () => {
  expect(liveness(job, now)?.heartbeat).toBe('尚未收到任务心跳')
  expect(liveness({ ...job, heartbeat_at: 'invalid', updated_at: 'invalid' }, now)?.state).toBe(
    'active',
  )
  expect(liveness({ ...job, status: 'failed' }, now)).toBeNull()
  expect(liveness(null, now)).toBeNull()
})

it('shows item progress during reading and indeterminate progress during saves', () => {
  const preparation: NonNullable<CurateProgress['preparation']> = {
    phase: 'reading',
    phase_started_at: job.started_at!,
    endpoints_read: 21,
    endpoints_total: 63,
    samples_read: 31,
    samples_unavailable: 1,
    fields: 200,
    values: 4567,
    relations: 0,
  }
  expect(phaseProgress({ ...job, preparation })).toBeCloseTo(100 / 3)
  for (const phase of ['analyzing', 'saving_values', 'saving_input'] as const)
    expect(phaseProgress({ ...job, preparation: { ...preparation, phase } })).toBeNull()
  expect(
    phaseProgress({ ...job, preparation: { ...preparation, phase: 'ready' }, completed: 21 }),
  ).toBeCloseTo(100 / 3)
})

it('does not offer same-round recovery before input was saved', () => {
  expect(
    processingHeadline(
      { ...job, status: 'failed', candidate_state: 'interrupted', resume_available: false },
      false,
    ),
  ).toBe('整理资料尚未保存完整，请开始新一轮整理')
})

it('does not report a queued accepted task as a stalled worker', () => {
  const queued = { ...job, task_id: 't', task_state: 'queued' as const }
  expect(liveness(queued, now)).toBeNull()
  expect(processingHeadline(queued, true)).toContain('任务已接受，正在排队')
})

it.each(['waiting', 'needs_attention'] as const)(
  'does not turn durable %s into a stale heartbeat warning',
  (state) => {
    const paused = {
      ...job,
      task_state: state,
      message: '等待服务恢复',
      heartbeat_at: '2026-10-01T00:00:00Z',
    }
    expect(liveness(paused, now)).toBeNull()
    expect(processingHeadline(paused, state === 'waiting')).toBe('等待服务恢复')
  },
)

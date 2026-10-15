import { afterEach, expect, it, vi } from 'vitest'
import { api } from '@/api'
import {
  diagnosticText,
  loadDiagnostic,
  type DiagnosticPackage,
} from '@/features/audit/diagnostics'
const summary = {
  id: 'candidate',
  project_id: 'project',
  target: null,
  state: 'partial',
  status: 'waiting',
  created_at: '',
  updated_at: '',
  stage: null,
  run_id: 'run',
  completed: null,
  total: null,
  fields_failed: null,
  issue_count: null,
}
function fixture(): DiagnosticPackage {
  const empty = () => ({ items: [], recorded: 0, included: 0, truncated: false })
  return {
    schema_version: 2,
    generated_at: '',
    project: { id: 'project', name: '合成项目' },
    candidate: { ...summary },
    subject: { ...summary, kind: 'candidate' },
    task: {
      id: 'task',
      project_id: 'project',
      candidate_id: 'candidate',
      state: 'waiting',
      run_id: 'run',
      generation: 3,
      retry_reason: 'model_unavailable',
      retry_count: 3,
      next_retry_at: '2026-10-12T12:00:00Z',
      observed_at: '',
      timing: null,
    },
    timing: {},
    counts: {},
    preparation: {},
    attempts: empty(),
    activities: empty(),
    issues: empty(),
    batches: empty(),
    operations: empty(),
    related_events: empty(),
    coverage: {
      source: 'persisted_task_and_candidate',
      activity_history: '',
      event_total: 0,
      event_included: 0,
      events_available: true,
      unknown_fields: [],
      redacted_fields: [],
      note: '',
    },
    agent_prompt: '仅依据证据',
  }
}
afterEach(() => vi.restoreAllMocks())
it('copies current waiting/attention plans without calling waiting a terminal failure', () => {
  const p = fixture()
  expect(diagnosticText(p)).toContain('等待自动恢复')
  expect(diagnosticText(p)).toContain('2026-10-12T12:00:00Z')
  p.subject!.status = 'needs_attention'
  p.task!.state = 'needs_attention'
  p.task!.next_retry_at = null
  expect(diagnosticText(p)).toContain('需要处理')
  expect(diagnosticText(p)).toContain('当前无自动重试计划')
})
it('loads and copies a task without inventing a candidate or numeric progress', async () => {
  const p = fixture()
  p.candidate = null
  p.subject = { ...summary, kind: 'task', id: 'task', status: 'queued' }
  p.task!.candidate_id = null
  vi.spyOn(api, 'request').mockResolvedValue(p)
  expect(await loadDiagnostic('project', 'task', new AbortController().signal, 'task')).toBe(p)
  expect(diagnosticText(p)).toContain('任务：task')
  expect(diagnosticText(p)).toContain('接口：未记录 / 未记录')
})
it('accepts legacy packages while rejecting contradictory task/candidate identity', async () => {
  const p = fixture()
  p.schema_version = 1
  delete p.task
  delete p.subject
  const request = vi.spyOn(api, 'request').mockResolvedValue(p)
  await expect(loadDiagnostic('project', 'candidate', new AbortController().signal)).resolves.toBe(
    p,
  )
  const bad = fixture()
  bad.task!.candidate_id = 'another'
  request.mockResolvedValue(bad)
  await expect(
    loadDiagnostic('project', 'candidate', new AbortController().signal),
  ).rejects.toMatchObject({ kind: 'invalid-response' })
})

it('preserves expired history and unknown original batch counts when copied for an Agent', async () => {
  const p = fixture()
  p.history = {
    available: false,
    reason_code: 'HISTORY_EXPIRED',
    retained_commands: 2,
    retained_batches: null,
    unavailable: ['candidate_details', 'commands', 'comparison', 'rollback'],
  }
  p.batches = {
    items: [],
    recorded: null,
    included: 0,
    truncated: null,
    available: false,
    unavailable_reason: 'HISTORY_EXPIRED',
  }
  p.agent_prompt = 'included=0 不等于原本没有批次；批次数为 null 表示未知。'
  vi.spyOn(api, 'request').mockResolvedValue(p)
  const loaded = await loadDiagnostic('project', 'candidate', new AbortController().signal)
  const text = diagnosticText(loaded)
  expect(text).toContain('HISTORY_EXPIRED')
  expect(text).toContain('"retained_commands": 2')
  expect(text).toContain('"recorded": null')
  expect(text).toContain('"truncated": null')
  expect(text).toContain(p.agent_prompt)
})

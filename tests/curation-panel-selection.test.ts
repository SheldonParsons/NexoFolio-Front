import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { CurateProgress } from '@/contracts/knowledge/types'
import type { CandidateState, CandidateSummary } from '@/features/curation/types'
import * as source from '@/features/curation/source'
import { useCurationPanel } from '@/features/curation/useCurationPanel'
import { usePanelSize } from '@/features/curation/usePanelSize'
import {
  preferredPanelRow,
  panelProgress,
  canObservePanelRun,
} from '@/features/curation/panelSelection'
import { processingHeadline } from '@/features/curation/activity'
import { ApiError } from '@/api'

vi.mock('@/features/curation/source', () => ({ panelCandidates: vi.fn(), candidates: vi.fn() }))
const scopes: ReturnType<typeof effectScope>[] = []
const row = (
  id: string,
  state: CandidateState,
  minute = 0,
  project_id = 'p',
): CandidateSummary => ({
  id,
  state,
  project_id,
  target: null,
  created_at: new Date(Date.UTC(2026, 9, 8, 0, minute)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 9, 8, 0, minute)).toISOString(),
  commands: 1,
  progress: { total: 3, completed: 3, fields_updated: 12 },
})
const flush = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(source.panelCandidates).mockResolvedValue([])
  vi.mocked(source.candidates).mockResolvedValue([])
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.useRealTimers()
  vi.resetAllMocks()
})
function fixture() {
  const pid = ref('p'),
    page = ref('/projects/p/interfaces'),
    live = ref<CurateProgress | null>(null),
    busy = ref(false),
    requested = ref('')
  const scope = effectScope()
  scopes.push(scope)
  const panel = scope.run(() =>
    useCurationPanel(
      () => pid.value,
      () => page.value,
      () => live.value,
      () => busy.value,
      vi.fn(),
      () => requested.value,
    ),
  )!
  return { pid, page, live, busy, requested, panel, scope }
}
it('prioritizes running, pending including interrupted, applied and discarded independently of recency', () => {
  const values = [
    row('run', 'running'),
    row('ready', 'ready', 1),
    row('partial', 'partial', 2),
    row('recover', 'interrupted', 3),
    row('applied', 'applied', 4),
    row('discarded', 'discarded', 5),
    row('foreign', 'running', 9, 'other'),
  ]
  expect(preferredPanelRow(values, 'p')?.id).toBe('run')
  expect(
    preferredPanelRow(
      values.filter((r) => r.state !== 'running'),
      'p',
    )?.id,
  ).toBe('recover')
  expect(
    preferredPanelRow(
      values.filter((r) => ['applied', 'discarded'].includes(r.state)),
      'p',
    )?.id,
  ).toBe('applied')
  expect(preferredPanelRow([row('old', 'discarded'), row('new', 'discarded', 1)], 'p')?.id).toBe(
    'new',
  )
  expect(preferredPanelRow([], 'p')).toBeNull()
})
it('does not revive discarded progress or invite reviewing applied content', () => {
  const closed = {
    ...row('c', 'discarded'),
    progress: { status: 'running' as const, active: [], total: 3 },
  }
  const projected = panelProgress(closed)
  expect(projected.status).toBe('done')
  expect(projected.candidate_state).toBe('discarded')
  expect(processingHeadline(projected, false)).not.toContain('审阅')
  expect(processingHeadline(panelProgress(row('a', 'applied')), false)).toContain('已应用')
})
it('does not repeatedly reattach a known terminal attempt but can observe a new attempt', () => {
  const running = { ...row('c', 'running'), progress: { run_id: 'old' } }
  const finished = { ...panelProgress(running), status: 'failed' as const }
  expect(canObservePanelRun(running, finished, false, true)).toBe(false)
  expect(
    canObservePanelRun({ ...running, progress: { run_id: 'new' } }, finished, false, true),
  ).toBe(true)
  expect(canObservePanelRun(running, null, true, true)).toBe(false)
  expect(canObservePanelRun(running, null, false, false)).toBe(false)
})
it('has no displayed task or running state when the project has no rounds', async () => {
  const f = fixture()
  await flush()
  expect(f.panel.selected.value).toBeNull()
  expect(f.panel.progress.value).toBeNull()
  expect(f.panel.busy.value).toBe(false)
  f.scope.stop()
  await vi.advanceTimersByTimeAsync(10000)
  expect(source.panelCandidates).toHaveBeenCalledTimes(1)
})
it('stops background reads after project access is denied', async () => {
  vi.mocked(source.panelCandidates).mockRejectedValue(new ApiError('forbidden', 'http', 403))
  const f = fixture()
  await flush()
  expect(f.panel.accessDenied.value).toBe(true)
  await vi.advanceTimersByTimeAsync(10000)
  expect(source.panelCandidates).toHaveBeenCalledTimes(1)
})
it('keeps manual history selection separate from the live worker and resets it on page entry', async () => {
  const run = row('live', 'running'),
    old = row('old', 'discarded')
  vi.mocked(source.panelCandidates).mockImplementation(async (_p, _s, selected) =>
    selected ? [run, old] : [run],
  )
  vi.mocked(source.candidates).mockResolvedValue([run, old])
  const f = fixture()
  await flush()
  f.live.value = { ...panelProgress(run), fields_updated: 16 }
  f.busy.value = true
  await flush()
  await f.panel.loadOptions()
  f.panel.select(old.id)
  await flush()
  expect(f.panel.progress.value?.candidate_id).toBe('old')
  expect(f.panel.busy.value).toBe(false)
  expect(f.panel.projectRunning.value).toBe(true)
  expect(f.live.value.fields_updated).toBe(16)
  expect(f.panel.historicalOnly.value).toBe(false)
  expect(source.panelCandidates).toHaveBeenLastCalledWith('p', expect.any(AbortSignal), 'old')
  f.page.value = '/projects/p/interfaces/endpoints/a'
  await flush()
  expect(f.panel.manual.value).toBeNull()
  expect(f.panel.progress.value?.candidate_id).toBe('live')
})
it('defaults historical-only panels to mini without overwriting the remembered actionable size', async () => {
  const actionableScope = effectScope()
  scopes.push(actionableScope)
  const normal = actionableScope.run(() => usePanelSize())!
  normal.setSize('compact')
  const historical = ref(true),
    scope = effectScope()
  scopes.push(scope)
  const local = scope.run(() => usePanelSize(() => historical.value))!
  expect(local.size.value).toBe('mini')
  local.setSize('full')
  expect(local.size.value).toBe('full')
  expect(normal.size.value).toBe('compact')
  historical.value = false
  await nextTick()
  expect(local.size.value).toBe('compact')
  historical.value = true
  await nextTick()
  expect(local.size.value).toBe('mini')
})
it('keeps the chosen history during passive observation and returns to default after an accepted user request', async () => {
  const pending = row('pending', 'ready'),
    old = row('old', 'discarded'),
    running = row('new-run', 'running')
  let preferred = pending
  vi.mocked(source.panelCandidates).mockImplementation(async (_p, _s, selected) =>
    selected ? [preferred, old] : [preferred],
  )
  vi.mocked(source.candidates).mockResolvedValue([pending, old])
  const f = fixture()
  await flush()
  await f.panel.loadOptions()
  f.panel.select(old.id)
  await flush()
  preferred = running
  f.live.value = panelProgress(running)
  f.busy.value = true
  await flush()
  expect(f.panel.progress.value?.candidate_id).toBe(old.id)
  f.requested.value = 'accepted-run'
  await flush()
  expect(f.panel.manual.value).toBeNull()
  expect(f.panel.progress.value?.candidate_id).toBe(running.id)
})
it('preserves the interrupted round as actionable and refreshes its selected metadata outside the history page', async () => {
  const recovered = row('recover', 'interrupted'),
    discarded = row('old', 'discarded')
  vi.mocked(source.panelCandidates).mockImplementation(async (_p, _s, selected) =>
    selected ? [recovered, discarded] : [recovered],
  )
  vi.mocked(source.candidates).mockResolvedValue([discarded])
  const f = fixture()
  await flush()
  expect(f.panel.historicalOnly.value).toBe(false)
  await f.panel.loadOptions()
  expect(f.panel.options.value.some((r) => r.id === recovered.id)).toBe(true)
})
it('ignores late results and selected rounds from another project', async () => {
  let finish!: (rows: CandidateSummary[]) => void
  vi.mocked(source.panelCandidates).mockImplementation(async (pid) =>
    pid === 'p'
      ? new Promise((resolve) => {
          finish = resolve
        })
      : [row('q-result', 'ready', 1, 'q')],
  )
  const f = fixture()
  const signal = vi.mocked(source.panelCandidates).mock.calls[0]![1]!
  f.pid.value = 'q'
  f.page.value = '/projects/q/interfaces'
  await flush()
  expect(signal.aborted).toBe(true)
  finish([row('p-result', 'ready')])
  await flush()
  expect(f.panel.selected.value?.id).toBe('q-result')
  f.panel.select('p-result')
  expect(f.panel.selected.value?.id).toBe('q-result')
})

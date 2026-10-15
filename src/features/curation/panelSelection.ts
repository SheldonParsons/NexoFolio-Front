import type { CurateProgress } from '@/contracts/knowledge/types'
import type { CandidateState, CandidateSummary } from './types'

export function panelRank(state: CandidateState): number {
  return state === 'running'
    ? 0
    : ['ready', 'partial', 'interrupted'].includes(state)
      ? 1
      : state === 'applied'
        ? 2
        : 3
}
export function preferredPanelRow(
  rows: CandidateSummary[],
  project: string,
): CandidateSummary | null {
  return (
    rows
      .filter((row) => row.project_id === project)
      .sort(
        (a, b) =>
          panelRank(a.state) - panelRank(b.state) ||
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          b.id.localeCompare(a.id),
      )[0] ?? null
  )
}
export function panelProgress(row: CandidateSummary): CurateProgress {
  const p = row.progress ?? {}
  return {
    ...p,
    status:
      p.task_state === 'waiting' && row.state === 'partial'
        ? 'running'
        : row.state === 'running'
          ? p.status === 'failed'
            ? 'failed'
            : 'running'
          : ['ready', 'applied', 'discarded'].includes(row.state)
            ? 'done'
            : 'failed',
    stage: p.stage ?? null,
    completed: p.completed ?? 0,
    total: p.total ?? 0,
    generated: p.generated ?? 0,
    unchanged: p.unchanged ?? 0,
    message: p.message ?? null,
    candidate_id: row.id,
    candidate_state: row.state,
    target: row.target,
    started_at: p.started_at ?? row.created_at,
    updated_at: p.updated_at ?? row.updated_at,
    active: row.state === 'running' ? p.active : [],
  }
}
export function panelOptions(
  rows: CandidateSummary[],
  preferred: CandidateSummary | null,
  selected: CandidateSummary | null,
): CandidateSummary[] {
  const values = new Map(rows.map((row) => [row.id, row]))
  if (preferred) values.set(preferred.id, preferred)
  if (selected) values.set(selected.id, selected)
  return [...values.values()].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id),
  )
}
export function canObservePanelRun(
  row: CandidateSummary | null,
  live: CurateProgress | null,
  busy: boolean,
  ready: boolean,
): boolean {
  if (!ready || busy || !row || panelProgress(row).status !== 'running') return false
  if (live?.task_id && live.task_id !== row.progress?.task_id) return false
  return !(
    live?.candidate_id === row.id &&
    live.run_id === row.progress?.run_id &&
    live.status !== 'running'
  )
}

import type { CurateProgress } from '@/contracts/knowledge/types'
/** A queue identity exists before its candidate and execution IDs. A takeover changes the execution. */
export function sameExecution(a: CurateProgress | null, b: CurateProgress): boolean {
  if (!a) return false
  if (a.task_id || b.task_id) return a.task_id === b.task_id && a.run_id === b.run_id
  return a.candidate_id === b.candidate_id && a.run_id === b.run_id
}
export function executionKey(p: CurateProgress | null): string {
  return p ? [p.task_id ?? '', p.candidate_id ?? '', p.run_id ?? ''].join(':') : ''
}

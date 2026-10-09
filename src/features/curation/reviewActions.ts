import type { CandidateState, CandidateSummary } from './types'
export type ReviewDecision = 'apply' | 'discard'
export type ReviewDecisionTarget = Pick<
  CandidateSummary,
  'id' | 'project_id' | 'created_at' | 'state'
>
export function canReviewDecision(state: CandidateState, action: ReviewDecision) {
  return (
    state === 'ready' || state === 'partial' || (action === 'discard' && state === 'interrupted')
  )
}

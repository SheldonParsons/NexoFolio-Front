import type {
  CurateProgress,
  EndpointNote,
  FieldNote,
  Folder,
  FieldLocation,
} from '@/contracts/knowledge/types'
export type CandidateState =
  | 'running'
  | 'ready'
  | 'partial'
  | 'applied'
  | 'discarded'
  | 'interrupted'
export interface KnowledgeLink {
  id: string
  from: string
  from_field: string | null
  to: string
  to_field: string | null
  relation: string
  evidence: string
  author: EndpointNote['author']
  at: string
  context: {
    from_location?: FieldLocation | null
    to_location?: FieldLocation | null
    environment?: string | null
    confirmation?: string
    condition?: string | null
    scope?: string | null
    sources?: Array<{
      example: string
      pointer?: string | null
      page?: string | null
      sequence?: number | null
    }>
  }
}
export interface KnowledgeSnapshot {
  endpoints: string[]
  folders: Folder[]
  placements: Array<{
    endpoint: string
    folder: string
    author: EndpointNote['author']
    at: string
  }>
  notes: EndpointNote[]
  fields: FieldNote[]
  links: KnowledgeLink[]
}
export interface CandidateSummary {
  id: string
  project_id: string
  target: string | null
  state: CandidateState
  created_at: string
  updated_at: string
  commands: number
  progress: Partial<CurateProgress>
}
export interface Candidate extends Omit<CandidateSummary, 'commands'> {
  operations?: CandidateOperation[]
  execution_input?: {
    prepared: {
      facts: import('@/contracts/knowledge/types').EndpointFacts[]
      inputs?: Record<
        string,
        Array<{
          key: string
          path: string
          location: FieldLocation
          observations?: import('@/contracts/knowledge/types').FieldObservationSummary
        }>
      >
    }
  } | null
  parent: string | null
  base_hash: string
  base: KnowledgeSnapshot
  view: KnowledgeSnapshot
  batches: Array<{ id: string; author: EndpointNote['author']; state: string; commands: unknown[] }>
  applied_rounds: string[]
  reviewed_by: string | null
}
export type CandidateActor =
  | { kind: 'user'; id: string; display_name: string | null }
  | { kind: 'system'; id: string; display_name: string }
  | { kind: 'unknown' }
export interface CandidateOperation {
  id: string
  action: 'organize' | 'resume' | 'apply' | 'discard'
  actor: CandidateActor
  at: string
  source: 'recorded' | 'legacy'
  name_source?: 'snapshot' | 'profile' | 'missing'
}
export interface CandidateOperations {
  events: CandidateOperation[]
  names_unavailable: boolean
}
export const candidateStateLabels: Record<CandidateState, string> = {
  running: '正在生成',
  ready: '待审阅',
  partial: '有缺口待审阅',
  applied: '已应用',
  discarded: '已废弃',
  interrupted: '中断可恢复',
}

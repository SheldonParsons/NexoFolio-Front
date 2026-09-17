/** UI presentation models only. No HTTP paths or backend payload contracts are defined here. */
export type KnowledgeBasis = 'observed' | 'inferred' | 'review-needed'
export interface EvidenceRef {
  id: string
  projectId: string
  label: string
  kind: 'text' | 'screenshot'
  resource?:
    | 'interface'
    | 'field'
    | 'fact'
    | 'image'
    | 'directory'
    | 'summary'
    | 'observation'
    | 'snapshot'
    | 'unknown'
  runId?: string
}
export interface Claim<T = string> {
  value: T
  basis: KnowledgeBasis
  evidence: EvidenceRef[]
}
export type SampleValue =
  | { kind: 'missing' }
  | { kind: 'null' }
  | { kind: 'unknown' }
  | { kind: 'value'; value: unknown }
export interface SemanticField {
  id: string
  path: string
  basis?: KnowledgeBasis
  note?: string
  boundRevision: string | null
  currentRevision: string | null
  stale?: boolean
  description: Claim | null
  sources: { fieldPath: string; relation: Claim }[]
  enumeration: {
    scope: 'observed-only' | 'complete' | 'unknown'
    scopeDescription: string
    evidence: EvidenceRef[]
    values: {
      sample: SampleValue
      label: Claim | null
      count: number | null
      evidence: EvidenceRef[]
    }[]
  }
}
export interface SemanticDocument {
  projectId: string
  interfaceId: string
  environmentId: string
  fields: SemanticField[]
}
export type WorkState = 'pending' | 'running' | 'complete' | 'failed' | 'missing'
export interface TaskProgress {
  id: string
  projectId: string
  state: 'queued' | 'running' | 'ready' | 'incomplete' | 'failed'
  phase?: string
  segments?: { completed: number; total: number }
  snapshot: {
    id: string
    createdAt: string
    interfaceCount: number | null
    fieldCount: number | null
    evidence: EvidenceRef[]
  }
  coverage: {
    total: number | null
    reviewed: number | null
    missing: number | null
    failed: number | null
    complete: boolean | null
  }
  shards: {
    id: string
    label: string
    state: WorkState
    reviewed: number | null
    total: number | null
    problem: string | null
  }[]
  readback: { state: WorkState | 'unknown'; description: string; evidence: EvidenceRef[] }
  strategy: { label: string; reason: string } | null
  problems: string[]
}
export type DiffValue = { present: false; known?: boolean } | { present: true; value: unknown }
export interface CandidateChange {
  id: string
  kind: 'directory' | 'description' | 'source-relation' | 'enum-label' | 'enum-scope'
  target: string
  before: DiffValue
  after: DiffValue
  basis: KnowledgeBasis
  reason: string
  evidence: EvidenceRef[]
  boundRevision: string | null
  currentRevision: string | null
  stale?: boolean
}
export interface MaintenanceCandidate {
  id: string
  projectId: string
  taskId: string
  baseGeneration: number | null
  changes: CandidateChange[]
  problems: string[]
}

export interface Folder {
  id: string
  parent: string | null
  name: string
  summary: string | null
  position: number
  endpoints: number
  endpoints_deep: number
}

export interface Catalog {
  project_id: string
  folders: Folder[]
  unplaced: number
}

/** Who wrote the words on an endpoint, or `null` before anything did. */
export type DescribedBy = 'person' | 'curate' | null

export interface EndpointCard {
  interface_id: string
  method: string
  path: string
  /** From the describe pass, or a person. `null` until one of them runs. */
  name: string | null
  purpose: string | null
  described_by?: DescribedBy
}

export interface EndpointPage {
  items: EndpointCard[]
  total: number
  page: number
  limit: number
}

/** `skipped` means the pass ran and decided there was nothing worth writing. */
export interface CurateResult {
  status: 'ok' | 'skipped'
  commands?: number
  fields_updated?: number
  fields_filled?: number
  fields_confirmation?: number
  fields_pending?: number
  fields_in_scope?: number
  values_archived?: boolean
}

/** Progress belongs to the shared project document, not one browser tab. */
export interface CurateProgress {
  lifecycle_version?: number
  lifecycle_stale?: boolean
  task_id?: string | null
  next_retry_at?: string | null
  retry_reason?: string | null
  retry_count?: number
  task_timing?: { queued_ms: number; waiting_ms: number; running_ms: number; since: string | null } | null
  task_state?: 'queued' | 'running' | 'waiting' | 'needs_attention' | 'done' | 'failed' | 'stopped' | null
  queued_tasks?: number
  status: 'idle' | 'running' | 'done' | 'failed'
  stage: 'describe' | 'fields' | 'organize' | null
  run_id?: string | null
  attempts?: number
  recovery_sweeps?: number
  attempt_history?: Array<{ run_id: string; started_at: string; ended_at: string | null; outcome: string | null }>
  candidate_id?: string | null
  candidate_state?: 'running' | 'ready' | 'partial' | 'interrupted' | 'applied' | 'discarded' | null
  target?: string | null
  started_at?: string | null
  attempt_started_at?: string | null
  updated_at?: string | null
  heartbeat_at?: string | null
  resume_available?: boolean | null
  preparation?: {
    phase: 'reading' | 'analyzing' | 'saving_values' | 'saving_input' | 'ready'
    phase_started_at: string
    endpoints_read: number
    endpoints_total: number
    samples_read: number
    samples_unavailable: number
    fields: number
    values: number
    relations: number
  } | null
  completed: number
  total: number
  generated: number
  unchanged: number
  fields_completed?: number
  fields_updated?: number
  fields_filled?: number
  fields_confirmation?: number
  fields_pending?: number
  fields_in_scope?: number
  values_archived?: boolean
  fields_total?: number
  fields_failed?: number
  fields_reused?: number
  retries?: number
  queued_batches?: number
  total_batches?: number
  completed_batches?: number
  model_calls?: number
  model_ms?: number
  save_ms?: number
  directory_completed?: boolean
  folders_saved?: number | null
  activity?: CurationActivityEvent[]
  active?: Array<{
    endpoint: string; name: string | null; path: string
    task_id?: number
    state?: 'model' | 'saving'
    fields: number; completed: number; batch: number; batches: number; attempt: number; started_at: string
  }>
  issues?: Array<{
    endpoint: string; stage: 'describe' | 'fields' | 'organize'; code: string
    message: string; fields: number; retryable: boolean
  }>
  message: string | null
}

export interface CurationActivityEvent {
  id: number
  at: string
  stage: 'describe' | 'fields' | 'organize'
  kind: string
  message: string
  endpoint?: string | null
  name?: string | null
  fields?: number | null
  batch?: number | null
  elapsed_ms?: number | null
}

export interface EnvironmentUsage {
  environment_id: string
  calls: number
  first_seen: string
  last_seen: string
}

export interface EndpointSummary {
  id: string
  project_id: string
  method: string
  path_template: string
  declared: boolean
  external: boolean
  environments: EnvironmentUsage[]
}

/** `in` discriminates; a response body also carries the status it was seen on. */
export type FieldLocation =
  | { in: 'path' }
  | { in: 'query' }
  | { in: 'request_header' }
  | { in: 'response_header'; status: number }
  | { in: 'request_body' }
  | { in: 'response_body'; status: number }

export interface FieldFacts {
  location: FieldLocation
  /** Segments; a string is a key, `"items"` is every element of an array. */
  path: Array<string | 'items' | { key: string }>
  types: string[]
  labels: Array<{ environment_id: string; label: { label: string; since?: string } }>
  differs_between_environments: boolean
  declared: { required: boolean; types: string[] } | null
  conflict: { type: string } | null
}

export interface ExampleSummary {
  structure_id?: string
  retained_samples?: number
  id: string
  environment_id: string
  address: unknown
  status: number | null
  calls: number
  first_seen: string
  last_seen: string
}

export interface EndpointFacts {
  summary: EndpointSummary
  aliases: string[]
  addresses: Array<{ environment_id: string; address: unknown; base_path: string }>
  fields: FieldFacts[]
  examples: ExampleSummary[]
  requests?: RequestMaterial[]
}

export interface EndpointNote {
  endpoint: string
  name: string | null
  purpose: string | null
  author: { by: 'person'; user: string } | { by: 'curate'; pass: string; model: string | null }
  at: string
  context?: { description?: string | null; unknowns?: string[]; authentication?: Array<{ carrier: string; scheme: string; credential_ref: string }> }
}

export interface EndpointKnowledge {
  note: EndpointNote | null
  placement: { endpoint: string; folder: string; at: string } | null
  path?: Folder[]
  fields?: FieldNote[]
  links?: unknown[]
}

export interface FieldEvidence {
  kind: 'inference' | 'observation' | 'related_interface' | 'direct_source'
  text: string
  endpoint: string
  field: string
  example: string | null
  environment: string | null
  options: Array<{ value: string; label: string | null }>
  source?: { example: string; environment: string | null; location: FieldLocation | null; pointer: string | null; page: string | null; sequence: number | null } | null
}

export interface FieldNote {
  endpoint: string
  path: string
  text: string
  values: string[]
  author?: EndpointNote['author']
  at?: string
  context?: {
    completion?: { name: AspectCompletion; description: AspectCompletion } | null
    observations?: FieldObservationSummary | null
    location: FieldLocation | null
    field_path: string | null
    input_hash: string | null
    structure?: { types: string[]; parent: string | null; siblings: string[] } | null
    display_name_confirmation?: 'candidate' | 'observed' | 'direct' | 'confirmed'
    display_name?: string | null
    meaning?: { unit?: string | null; role?: string | null; details?: string[]; unknowns?: string[]; confirmation?: 'candidate' | 'observed' | 'direct' | 'confirmed' }
    evidence: FieldEvidence[]
  }
}

export interface EndpointDetail {
  retired_source_count?: number
  lifecycle?: import('./lifecycle').DocumentLifecycle
  facts: EndpointFacts
  knowledge: EndpointKnowledge | null
}


export interface CapturedHeaders { complete: boolean; entries: [string, string][] }
export type CapturedBody =
  | { state: 'none' }
  | { state: 'unreadable'; media_type: string | null; note?: string | null }
  | { state: 'full' | 'truncated' | 'partial'; media_type: string | null; content: { encoding: 'text' | 'binary'; data: string | number[] }; note?: string | null; original_bytes?: number | null }
export interface RequestMaterial {
  example_id: string
  observation_key?: { batch_id: string; record_id: string } | null
  environment_id: string | null
  observed_at: string
  source: { platform: string; platform_version?: string | null; source_url?: string | null }
  request: { method: string; url: string; url_truncated: boolean; headers: CapturedHeaders | null; body: CapturedBody }
  body_root: unknown
  response_status: number | null
  response_headers: CapturedHeaders | null
  authentication: Array<{ carrier: string; scheme: string | null; current_validity: string; required: boolean | null; acquisition_source: string | null }>
  gaps: string[]
}

export interface AspectCompletion { state: 'missing' | 'filled' | 'uncertain'; reason: string | null }
export interface FieldObservationSummary { archive_id: string | null; total: number; hash: string; states: Record<string, number> }
export interface ObservedValuePreview {
  id: string; value_type: string; representation: string; preview: string; preview_truncated: boolean; occurrences: number
  sources: Array<{ example: string; environment: string | null; pointer: string | null; complete: boolean | null }>; sources_total: number
}
export interface ObservedValuePage { summary: FieldObservationSummary; items: ObservedValuePreview[]; offset: number; limit: number; has_more: boolean }

export interface CurationTaskSummary {
  id: string; project_id: string; target: string | null; candidate_id: string | null
  state: 'queued' | 'running' | 'waiting' | 'needs_attention' | 'done' | 'failed' | 'stopped'; created_at: string
}

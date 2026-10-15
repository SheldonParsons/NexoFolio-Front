export interface Snapshot<T> {
  value: T | null
  sampled_at: string | null
  attempted_at: string | null
  source: string
  scope: string
  stale_after_seconds: number
  error: string | null
}
export type TaskState =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'needs_attention'
  | 'done'
  | 'failed'
  | 'stopped'
export interface Cursor {
  created_at: string
  id: string
}
export interface OperationsTask {
  id: string
  project_id: string
  candidate_id: string | null
  target: string | null
  state: TaskState
  run_id: string | null
  generation: number
  created_at: string
  updated_at: string
  lease_until: string | null
  retry_reason: string | null
  retry_count: number
  next_retry_at: string | null
  stage: string | null
  heartbeat_at: string | null
  checkpoint: {
    run_id: string | null
    stage: string | null
    completed: number | null
    total: number | null
    completed_batches: number | null
    saved_batch_records: number | null
    updated_at: string | null
  } | null
}
export interface TaskPage {
  projects: Record<string, string>
  page: { items: OperationsTask[]; next: Cursor | null; observed_at: string }
  source: string
  scope: string
  stale_after_seconds: number
  limit: number
}
export interface Latency {
  samples: number
  mean_ms: number | null
  p95_ms: number | null
}
export interface Model {
  http_in_flight: number
  permits_in_use: number
  waiting_for_permit: number
  current_limit: number
  configured_limit: number
  cooldown_remaining_ms: number
  completed: number
  cancelled: number
  failures: Record<string, number>
  queue: Latency
  request: Latency
}
export interface Pool {
  name: string
  size: number
  idle: number
  configured_max: number
  waiting: number | null
  acquire_timeouts: number | null
}
export interface Intake {
  totals: {
    batches: number
    accepted_batches: number
    received_bytes: number
    unreadable_bodies: number
    http_429: number
    http_503: number
    mean_receive_ms: number | null
    latency_samples: number
    fetcher_local_queue: number | null
  }
  window_seconds: number | null
  batches_per_second: number | null
  bytes_per_second: number | null
}
export interface Summary {
  instance_id: string
  process_id: number
  started_at: string
  sampled_at: string | null
  sample_interval_seconds: number
  tasks: Snapshot<{ state: TaskState; count: number }[]>
  model: Snapshot<Model>
  pools: Snapshot<Pool[]>
  intake: Snapshot<Intake>
  resources: {
    rss_bytes: Snapshot<number>
    cpu_cores: Snapshot<number>
    container_limit_bytes: Snapshot<number>
    host_available_bytes: Snapshot<number>
  } | null
  history: { at: string; rss_bytes: number | null; cpu_cores: number | null }[]
}

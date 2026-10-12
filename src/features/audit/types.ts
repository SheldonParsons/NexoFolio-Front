export interface AuditEvent {
  at: string
  kind: string
  action: string
  actor: string
  route: string
  method: string
  status: number
  duration_ms: number
  request_id: string
  project: string
  resource: string
  code: string
}
export interface Bucket {
  key: string
  hour: string
  kind: string
  actor: string
  route: string
  method: string
  status: number
  hits: number
  duration_ms: number
  max_duration_ms: number
  project: string
}
export interface Report {
  actors?: Record<string, string>
  summary: { route: string; hits: number; actors: number }[]
  events: AuditEvent[]
  buckets: Bucket[]
  storage: {
    events: number
    buckets: number
    bytes: number
    evicted_events: number
    evicted_buckets: number
  }
  health?: {
    enabled: boolean
    dropped_access: number
    dropped_important: number
    storage_failures: number
    queued_access: number
    queued_important: number
  }
  limits?: {
    events: number
    buckets: number
    access_days: number
    error_days: number
    operation_days: number
  }
}

import { api, ApiError } from '@/api'
export interface DiagnosticSummary {
  commands?: number
  history_available?: boolean
  retained_commands?: number | null
  retained_batches?: number | null
  kind?: 'candidate' | 'task'
  task_id?: string | null
  task_state?: string | null
  next_retry_at?: string | null
  id: string
  project_id: string
  target: string | null
  state: string
  status: string
  created_at: string
  updated_at: string
  failure_code?: string | null
  stage: string | null
  run_id: string | null
  completed: number | null
  total: number | null
  fields_failed: number | null
  issue_count: number | null
}
export type Facts = Record<
  string,
  | string
  | number
  | boolean
  | null
  | { task_id: string | null; run_id: string | null; generation: number | null }
>
export interface EvidenceRows {
  items: Facts[]
  recorded: number | null
  included: number
  truncated: boolean | null
  available?: boolean | null
  unavailable_reason?: 'HISTORY_EXPIRED' | null
}
export interface DiagnosticPackage {
  history?: {
    available: boolean | null
    reason_code: 'HISTORY_EXPIRED' | null
    retained_commands: number | null
    retained_batches: number | null
    unavailable: string[]
  }
  liveness?: {
    lease_stale?: boolean | null
    heartbeat_age_seconds: number | null
    heartbeat_stale: boolean
    threshold_seconds: number
  }
  schema_version: number
  generated_at: string
  project: { id: string; name: string }
  candidate: DiagnosticSummary | null
  subject?: DiagnosticSummary
  task?: {
    id: string
    project_id: string
    candidate_id: string | null
    state: string
    run_id: string | null
    generation: number
    retry_reason: string | null
    retry_count: number
    next_retry_at: string | null
    observed_at: string
    timing: {
      queued_ms: number
      running_ms: number
      waiting_ms: number
      since: string | null
    } | null
  } | null
  timing: Facts
  counts: Record<string, number | null>
  preparation: Facts
  attempts: EvidenceRows
  activities: EvidenceRows
  issues: EvidenceRows
  batches: EvidenceRows
  operations: EvidenceRows
  related_events: EvidenceRows
  coverage: {
    source: string
    activity_history: string
    event_total: number | null
    event_included: number
    events_available: boolean
    unknown_fields: string[]
    redacted_fields: string[]
    note: string
  }
  agent_prompt: string
}
export const statusLabels: Record<string, string> = {
  unknown: '当前任务状态未记录',
  queued: '排队中',
  waiting: '等待自动恢复',
  needs_attention: '需要处理',
  running: '运行中',
  review: '等待审阅',
  applied: '已应用',
  gaps: '存在缺口',
  failed: '失败待排查',
  stopped: '人工停止',
  interrupted: '已中断，可检查恢复条件',
  discarded: '已放弃本轮',
}
export const stageLabels: Record<string, string> = {
  describe: '接口说明',
  fields: '字段整理',
  organize: '目录与关联',
}
export const fact = (value: unknown) =>
  value === null || value === undefined ? '未记录' : String(value)
export function diagnosticSubject(value: DiagnosticPackage): DiagnosticSummary {
  const subject = value.subject ?? value.candidate
  if (!subject) throw new ApiError('诊断对象缺失，请重新读取。', 'invalid-response')
  return subject
}
export function diagnosticSummary(value: DiagnosticPackage) {
  const c = diagnosticSubject(value),
    task = value.task
  return `NexoFolio 整理排查\n项目：${value.project.name}\n${c.kind === 'task' ? '任务' : '轮次'}：${c.id}\n状态：${statusLabels[c.status] || c.status}\n持久任务：${fact(task?.id)}；重试原因：${fact(task?.retry_reason)}；重试次数：${fact(task?.retry_count)}；下次尝试：${task?.state === 'waiting' ? fact(task.next_retry_at) : task ? '当前无自动重试计划' : '未记录'}\n阶段：${c.stage ? stageLabels[c.stage] || c.stage : '未记录 / 当前无执行阶段'}\n接口：${fact(value.counts.completed)} / ${fact(value.counts.total)}；失败字段：${fact(value.counts.fields_failed)}；重试：${fact(value.counts.retries)}\n覆盖：持久任务状态与候选检查点分别记录；阶段活动只保留近期记录；关联事件严格匹配本项目和本候选，可能受审计保留和采集缺失影响。\n未知字段为 null / 未记录，未包含样本正文或凭证。`
}
export function diagnosticText(value: DiagnosticPackage) {
  return `${diagnosticSummary(value)}\n\n给 Agent：${value.agent_prompt}\n\n结构化诊断：\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``
}
export async function loadCurationList(project: string, signal: AbortSignal) {
  const result = await api.request<{
    items: DiagnosticSummary[]
    limit: number
    scope: string
    note: string
  }>(`v1/audit/curations/${encodeURIComponent(project)}`, { signal })
  if (
    !result ||
    !Array.isArray(result.items) ||
    result.items.some(
      (row) =>
        row.project_id !== project || typeof row.id !== 'string' || typeof row.status !== 'string',
    )
  )
    throw new ApiError('整理轮次数据不完整，请刷新。', 'invalid-response')
  return result
}
export async function loadDiagnostic(
  project: string,
  candidate: string,
  signal: AbortSignal,
  kind: 'candidate' | 'task' = 'candidate',
) {
  const result = await api.request<DiagnosticPackage>(
    `v1/audit/curations/${encodeURIComponent(project)}/${kind === 'task' ? 'tasks/' : ''}${encodeURIComponent(candidate)}`,
    { signal },
  )
  if (
    !result ||
    ![1, 2].includes(result.schema_version) ||
    result.project?.id !== project ||
    (kind === 'task'
      ? result.task?.id !== candidate || result.task.project_id !== project
      : result.candidate?.id !== candidate || result.candidate.project_id !== project) ||
    (result.subject ?? result.candidate)?.project_id !== project ||
    (result.subject !== undefined &&
      result.subject.id !== (result.candidate?.id ?? result.task?.id)) ||
    (result.task?.candidate_id != null && result.task.candidate_id !== result.candidate?.id) ||
    !result.coverage ||
    !result.counts ||
    !result.timing ||
    ['attempts', 'activities', 'issues', 'batches', 'operations', 'related_events'].some(
      (key) => !Array.isArray(result[key as 'issues']?.items),
    )
  )
    throw new ApiError('诊断包不完整或轮次不匹配，请重新读取。', 'invalid-response')
  return result
}

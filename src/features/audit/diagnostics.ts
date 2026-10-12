import { api, ApiError } from '@/api'
export interface DiagnosticSummary {
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
export type Facts = Record<string, string | number | boolean | null>
export interface EvidenceRows {
  items: Facts[]
  recorded: number
  included: number
  truncated: boolean
}
export interface DiagnosticPackage {
  liveness?: {
    heartbeat_age_seconds: number | null
    heartbeat_stale: boolean
    threshold_seconds: number
  }
  schema_version: number
  generated_at: string
  project: { id: string; name: string }
  candidate: DiagnosticSummary
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
export function diagnosticSummary(value: DiagnosticPackage) {
  const c = value.candidate
  return `NexoFolio 整理排查\n项目：${value.project.name}\n轮次：${c.id}\n状态：${statusLabels[c.status] || c.status}\n阶段：${c.stage ? stageLabels[c.stage] || c.stage : '未记录 / 当前无执行阶段'}\n接口：${fact(value.counts.completed)} / ${fact(value.counts.total)}；失败字段：${fact(value.counts.fields_failed)}；重试：${fact(value.counts.retries)}\n覆盖：持久化候选；阶段活动只保留近期记录；关联事件严格匹配本项目和本候选，可能受审计保留和采集缺失影响。\n未知字段为 null / 未记录，未包含样本正文或凭证。`
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
export async function loadDiagnostic(project: string, candidate: string, signal: AbortSignal) {
  const result = await api.request<DiagnosticPackage>(
    `v1/audit/curations/${encodeURIComponent(project)}/${encodeURIComponent(candidate)}`,
    { signal },
  )
  if (
    !result ||
    result.schema_version !== 1 ||
    result.project?.id !== project ||
    result.candidate?.id !== candidate ||
    result.candidate.project_id !== project ||
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

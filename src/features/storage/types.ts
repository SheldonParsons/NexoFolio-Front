import type { Snapshot } from '@/features/operations/types'
export interface Usage {
  groups: {
    name: string
    rows: number | null
    column_bytes: number | null
    logical_bytes: number | null
  }[]
  tables: { name: string; table_bytes: number; index_bytes: number }[]
}
export interface StorageState {
  snapshot: {
    project: string
    modules: Snapshot<Usage>[]
    retention: Snapshot<{
      enabled_at: string | null
      protected_until: string | null
      stopped_recoverable: string[]
      more_stopped: boolean
    }>
  }
  execution_allowed: boolean
}
export interface MaintenanceResult {
  project: string
  at: string
  outcome: 'preview' | 'committed' | 'not_committed' | 'unknown' | 'failed'
  report: {
    committed: boolean
    scanned: number
    compacted: number
    inputs_released: number
    archives_reclaimed: number
    chunks_deleted: number
    grace_started: number
    skipped: Record<string, number>
    deferred_objects: Record<string, string>
    next: string | null
  } | null
}
export const reasons: Record<string, string> = {
  project_busy: '项目正在写入，本批未处理',
  activation_grace_7_days: '尚未启用或仍在首次7天保护期',
  batch_time_budget: '本批时间已用完，下批继续',
  recoverable_or_active: '任务仍在运行、待审核或可恢复',
  closed_less_than_7_days: '结束尚未满7天',
  retained_rollback_group: '回滚分组仍受保护',
  archive_referenced: '证据仍被引用',
  already_reclaimed: '此前已回收',
  no_archive_payload: '没有可回收正文',
  archive_grace_7_days: '证据仍在无引用7天宽限期',
  unknown_history_shape: '历史格式需核对，延后处理',
  header_over_4_mib: '快照头超出本批读取上限',
  unknown_input_format: '执行资料格式需核对',
  invalid_manifest: '快照清单需核对',
  invalid_evidence_chunks: '证据块需核对',
}

export function bytes(value: number | null | undefined) {
  if (value == null) return '未统计'
  if (value < 1024) return `${value} B`
  const unit = value < 1048576 ? 'KiB' : 'MiB'
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 }).format(value / (unit === 'KiB' ? 1024 : 1048576))} ${unit}`
}

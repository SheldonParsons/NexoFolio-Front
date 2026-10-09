import type { CurateProgress } from '@/contracts/knowledge/types'

export function progressLabel(progress: CurateProgress | null): string {
  if (!progress) return '正在启动整理任务'
  if (progress.status === 'done') return '整理完成，等待你的审阅'
  if (progress.status === 'failed')
    return progress.candidate_id ? '部分内容待补充，已完成结果保留' : '本轮整理未全部完成'
  if (progress.message) return progress.message
  return progress.stage === 'fields'
    ? '吸收证据，补充字段知识'
    : progress.stage === 'organize'
      ? '组织业务模块与功能分组'
      : '补充接口名称与用途'
}
export function phaseProgress(progress: CurateProgress | null): number | null {
  if (progress?.preparation && progress.preparation.phase !== 'ready') {
    const preparation = progress.preparation
    // Only reading has measurable item progress; analysis/save durations are unknown.
    return preparation.phase === 'reading' && preparation.endpoints_total
      ? Math.min(100, Math.max(0, (preparation.endpoints_read / preparation.endpoints_total) * 100))
      : null
  }
  if (!progress || progress.stage === 'organize' || !progress.total) return null
  if (progress.stage === 'fields' && progress.fields_in_scope)
    return Math.min(
      100,
      Math.max(
        0,
        ((progress.fields_in_scope - (progress.fields_pending ?? 0)) / progress.fields_in_scope) *
          100,
      ),
    )
  if (progress.stage === 'fields' && progress.fields_total)
    return Math.min(
      100,
      Math.max(0, ((progress.fields_updated ?? 0) / progress.fields_total) * 100),
    )
  const completed =
    progress.stage === 'fields' ? (progress.fields_completed ?? 0) : progress.completed
  return Math.min(100, Math.max(0, (completed / progress.total) * 100))
}
export function elapsedLabel(started: string | null | undefined, now: number): string {
  if (!started) return '刚刚开始'
  const seconds = Math.max(0, Math.floor((now - Date.parse(started)) / 1000))
  if (!Number.isFinite(seconds)) return '—'
  return seconds < 60
    ? `${seconds} 秒`
    : `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
}

import type { CurateProgress } from '@/contracts/knowledge/types'

export function unfinishedFields(progress: CurateProgress | null): number {
  if (!progress) return 0
  return Math.max(0, (progress.fields_total ?? 0) - (progress.fields_updated ?? 0))
}
export function processingHeadline(progress: CurateProgress | null, busy: boolean): string {
  if (!progress) return '正在启动整理任务'
  if (progress.task_state === 'stopped')
    return progress.candidate_id ? '任务已停止，已保存批次保留' : '排队已取消，任务未开始执行'
  if (progress.task_state === 'waiting' || progress.task_state === 'needs_attention')
    return progress.message || '已保存成果保留'
  if (progress.task_state === 'queued') return '任务已接受，正在排队；关闭页面不影响执行'
  if (progress.candidate_state === 'applied') return '本轮内容已应用到现行文档'
  if (progress.candidate_state === 'discarded') return '本轮结果已废弃，仅保留历史记录'
  if (progress.candidate_state === 'interrupted')
    return progress.resume_available === false
      ? '整理资料尚未保存完整，请开始新一轮整理'
      : '本轮已中断，可补齐已保存内容的缺口'
  if (!busy)
    return progress.status === 'done'
      ? '候选结果已保存，可以开始审阅'
      : '本轮已结束，部分内容需要补齐'
  if (progress.message) return progress.message
  if (progress.stage === 'fields') {
    const active = progress.active?.length ?? 0,
      queued = progress.queued_batches
    return active
      ? `正在处理 ${active} 批字段${queued ? `，另有 ${queued} 批排队` : ''}`
      : '正在核对字段变化与证据'
  }
  return progress.stage === 'organize'
    ? '正在整理业务模块与功能分组'
    : '正在核对接口名称、用途和资料'
}
export function legacyProcessingSummary(progress: CurateProgress): string[] {
  const result = [
    `接口说明：生成 ${progress.generated} 个，复用 ${progress.unchanged} 个`,
    `字段说明：本轮保存 ${progress.fields_updated ?? 0} 个，复用 ${progress.fields_reused ?? 0} 个`,
  ]
  if (progress.status !== 'running' && unfinishedFields(progress))
    result.push(`${unfinishedFields(progress)} 个字段的本轮更新尚未完成`)
  if (progress.directory_completed) result.push('目录构建结果已保存')
  if (progress.folders_saved != null) result.push(`已保留 ${progress.folders_saved} 个目录候选`)
  return result
}

import type { Snapshot, TaskState } from './types'
export const stateLabels: Record<TaskState, string> = {
  queued: '排队中',
  running: '运行中',
  waiting: '等待恢复',
  needs_attention: '需要处理',
  done: '已完成',
  failed: '执行失败',
  stopped: '已停止',
}
export const stateOptions = [
  { value: 'all', label: '全部状态' },
  ...Object.entries(stateLabels).map(([value, label]) => ({ value, label })),
]
export const reasonLabels: Record<string, string> = {
  model_configuration: '模型配置需要检查',
  model_network: '模型连接暂不可用',
  model_timeout: '模型请求超时',
  model_rate_limited: '模型请求受到限流',
  model_unavailable: '模型服务暂不可用',
  model_rejected: '模型服务拒绝请求',
  model_cooldown: '等待模型冷却结束',
  invalid_reply: '模型回复需要检查',
  RESOURCE_NOT_FOUND: '关联资料不存在',
  SERVICE_UNAVAILABLE: '依赖服务暂不可用',
  CURATION_NOT_SUBMITTED: '提交未确认',
  CANDIDATE_CONFLICT: '资料版本冲突',
  PASS_FAILED: '整理阶段需要检查',
  PROJECT_BUSY: '项目正忙',
}
export const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? '未采集'
    : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits }).format(value)
export const time = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(value))
    : '未采集'
export const mib = (value: number | null | undefined) =>
  value == null ? '未采集' : `${number(value / 1048576, 1)} MiB`
export function freshness(
  value: Pick<Snapshot<unknown>, 'sampled_at' | 'stale_after_seconds' | 'error'> | null | undefined,
  now: number,
) {
  if (!value?.sampled_at) return '未采集'
  if (value.error || now - Date.parse(value.sampled_at) > value.stale_after_seconds * 1000)
    return '已过期'
  return '快照有效'
}

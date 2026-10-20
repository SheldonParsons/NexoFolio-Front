import type { ProjectCuration } from './types'
const labels = {
  queued: '排队中',
  running: '正在整理',
  waiting: '等待重试',
  needs_attention: '需要处理',
  failed: '整理失败',
  stopped: '已停止',
}
const dateFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
export function curationLabel(curation?: ProjectCuration | null): string {
  if (!curation) return '无'
  if (curation.state !== 'done') return labels[curation.state]
  if (!curation.started_at) return '已完成 · 开始时间未知'
  return dateFormat.format(new Date(curation.started_at)).replaceAll('/', '-')
}
export function curatorLabel(curation?: ProjectCuration | null): string {
  return curation ? curation.actor_name?.trim() || '未知' : '无'
}

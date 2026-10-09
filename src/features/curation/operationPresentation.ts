import type { CandidateActor, CandidateOperation } from './types'
export const operationLabels: Record<CandidateOperation['action'], string> = {
  organize: '发起整理',
  resume: '补齐本轮',
  apply: '应用结果',
  discard: '废弃结果',
}
export function actorLabel(actor: CandidateActor): string {
  if (actor.kind === 'system') return actor.display_name || '系统'
  if (actor.kind === 'user') return actor.display_name?.trim() || `用户 ${actor.id.slice(0, 8)}`
  return '操作者未记录'
}
export function operationNote(event: CandidateOperation): string {
  if (event.actor.kind === 'unknown')
    return event.source === 'legacy' ? '旧记录未保留操作者信息' : '执行者身份未记录'
  if (event.name_source === 'profile')
    return event.source === 'legacy' ? '旧记录 · 名称来自现有资料' : '名称来自现有资料'
  if (event.source === 'legacy') return '旧记录保留的身份与时间'
  if (event.actor.kind === 'user' && !event.actor.display_name) return '已保留用户 ID，名称暂不可用'
  return event.actor.kind === 'system' ? '系统身份' : ''
}

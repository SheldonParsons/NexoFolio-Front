import type { CurateProgress, CurationActivityEvent } from '@/contracts/knowledge/types'

export type ActiveWork = NonNullable<CurateProgress['active']>[number]
export type ProcessingState = 'working' | 'saving' | 'retrying' | 'saved' | 'gap' | 'idle'

export function workKey(stage: CurateProgress['stage'], item: ActiveWork): string {
  return `${stage}:${item.endpoint}:${item.task_id ?? 0}:${item.batch}`
}

export function workState(item: ActiveWork): ProcessingState {
  if (item.state === 'saving') return 'saving'
  return item.attempt > 1 ? 'retrying' : 'working'
}

export function workLabel(item: ActiveWork): string {
  return item.state === 'saving'
    ? '正在校验与保存回复'
    : item.attempt > 1
      ? '正在重试，已保存内容保留'
      : '等待模型回复'
}

export function eventState(event: CurationActivityEvent): ProcessingState {
  if (event.kind === 'saved' || event.kind === 'complete') return 'saved'
  if (event.kind === 'gap' || event.kind === 'partial') return 'gap'
  if (event.kind === 'retry') return 'retrying'
  return 'idle'
}

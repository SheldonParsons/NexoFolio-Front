import type { CurationTaskSummary } from '@/contracts/knowledge/types'

/** This is admission guidance, not an independent task-state machine. */
export function startIntent(task: CurationTaskSummary | undefined, otherActive: boolean) {
  if (task) {
    const state = {
      queued: '正在排队',
      running: '正在执行',
      waiting: '正在等待上游恢复',
      needs_attention: '需要处理',
    }[task.state as 'queued' | 'running' | 'waiting' | 'needs_attention']
    if (task.state === 'needs_attention')
      return {
        title: '当前范围的任务需要处理',
        description: task.candidate_id
          ? '先查看待处理原因。修复后可续跑原候选，或在进度面板停止任务后重新开始。查看任务不会重新提交。'
          : '任务尚未生成候选。先查看原因；修复后可明确重新提交，或在进度面板停止后重新开始。查看任务不会重新提交。',
        label: '查看待处理任务',
        observe: true,
      }
    return {
      title: `当前范围${state}`,
      description: `提交时若该任务仍未结束，会复用同一任务${task.state === 'waiting' ? '并继续按原计划等待恢复' : ''}。关闭页面不影响执行；提交回执会显示实际接受的任务。`,
      label: '提交并查看任务',
      observe: false,
    }
  }
  return {
    title: '开始新一轮整理？',
    description: `根据最新采集资料和正式文档生成候选，完成后仍由你审阅并决定是否应用。${otherActive ? '其他范围有活动任务，本次范围可提交并按项目顺序排队。' : ''}若提交前已有同范围任务，后台会复用它，以回执为准。`,
    label: '开始新一轮整理',
    observe: false,
  }
}

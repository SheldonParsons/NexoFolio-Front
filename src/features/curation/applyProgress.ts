import type { ApplyStatus } from './types'
export function applyMessage(progress: ApplyStatus['progress']): string {
  if (!progress) return '服务器阶段暂不可用，正在核对保存状态…'
  switch (progress.stage) {
    case 'waiting':
      return '等待项目操作完成…'
    case 'validating':
      return '正在校验候选、冻结证据与现行文档…'
    case 'writing':
      return `正在写入变更：已处理 ${progress.processed} / ${progress.total} 条候选命令（尚未提交，包含保留人工内容的检查）`
    case 'committing':
      return '正在确认事务提交，变更尚未确认生效…'
    case 'committed':
      return '服务器已应用，正在刷新页面…'
    case 'failed':
      return '服务器未应用此候选'
    case 'unknown':
      return '应用结果尚未确认，正在核对保存状态…'
  }
}

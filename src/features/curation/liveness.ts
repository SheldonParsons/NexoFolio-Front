import type { CurateProgress } from '@/contracts/knowledge/types'
import { elapsedLabel } from './progress'

function age(value: string | null | undefined, now: number): number | null {
  const parsed = value ? Date.parse(value) : NaN
  return Number.isFinite(parsed) ? Math.max(0, now - parsed) : null
}

/** A successful poll or heartbeat does not prove that work has advanced. */
export function liveness(progress: CurateProgress | null, now: number) {
  if (!progress || progress.status !== 'running') return null
  const last = progress.updated_at ?? progress.attempt_started_at ?? progress.started_at
  const quiet = age(last, now)
  const heartbeat = age(progress.heartbeat_at, now)
  const state =
    heartbeat !== null && heartbeat > 60_000
      ? 'stale'
      : quiet !== null && quiet >= 120_000
        ? 'waiting'
        : 'active'
  return {
    state,
    warning:
      state === 'stale'
        ? '任务心跳超过 1 分钟未更新，暂时无法确认运行状态。'
        : state === 'waiting'
          ? '超过 2 分钟没有新进展，可能在等待模型或保存结果；心跳不代表处理完成。'
          : '',
    progress: last ? `距上次进展 ${elapsedLabel(last, now)}` : '等待首次处理进展',
    heartbeat:
      heartbeat === null
        ? '尚未收到任务心跳'
        : `距上次任务心跳 ${elapsedLabel(progress.heartbeat_at, now)}`,
  }
}

export const preparationLabels = {
  reading: '读取真实样本',
  analyzing: '分析字段与关系',
  saving_values: '保存完整观测值',
  saving_input: '保存本轮整理输入',
  ready: '整理资料已就绪',
} as const

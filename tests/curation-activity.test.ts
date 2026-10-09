import { expect, it } from 'vitest'
import {
  unfinishedFields,
  processingHeadline,
  legacyProcessingSummary,
} from '@/features/curation/activity'
import type { CurateProgress } from '@/contracts/knowledge/types'
const progress: CurateProgress = {
  status: 'failed',
  stage: 'organize',
  completed: 63,
  total: 63,
  generated: 55,
  unchanged: 8,
  fields_completed: 63,
  fields_updated: 1664,
  fields_total: 1712,
  fields_failed: 2,
  fields_reused: 307,
  message: '2 个接口有字段未完成',
  directory_completed: true,
  folders_saved: 33,
}
it('keeps completed interface counts distinct from missing field updates', () => {
  expect(unfinishedFields(progress)).toBe(48)
  expect(legacyProcessingSummary(progress)).toContain('48 个字段的本轮更新尚未完成')
  expect(legacyProcessingSummary(progress)).toContain('已保留 33 个目录候选')
  expect(processingHeadline(progress, false)).toBe('本轮已结束，部分内容需要补齐')
})
it('describes real preparation and queue state without inventing model reasoning', () => {
  expect(
    processingHeadline(
      { ...progress, status: 'running', message: '正在读取采集资料', stage: 'describe' },
      true,
    ),
  ).toBe('正在读取采集资料')
  expect(
    processingHeadline(
      {
        ...progress,
        status: 'running',
        message: null,
        stage: 'fields',
        queued_batches: 3,
        active: [
          {
            endpoint: 'a',
            name: '接口 A',
            path: '/a',
            fields: 24,
            completed: 0,
            batch: 1,
            batches: 2,
            attempt: 1,
            started_at: '2026-10-08T00:00:00Z',
          },
        ],
      },
      true,
    ),
  ).toBe('正在处理 1 批字段，另有 3 批排队')
})
it('does not label unknown legacy directory progress as completed', () => {
  expect(
    legacyProcessingSummary({
      ...progress,
      directory_completed: undefined,
      folders_saved: undefined,
    }),
  ).not.toContain('目录构建结果已保存')
  expect(unfinishedFields(null)).toBe(0)
})

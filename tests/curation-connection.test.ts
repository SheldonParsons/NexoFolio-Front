import { afterEach, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/client'
import * as knowledge from '@/contracts/knowledge/source'
import { reconnectCuration } from '@/features/documents/curationConnection'
import { useDocumentCuration } from '@/features/documents/useDocumentCuration'
import { documentRequests } from '@/features/documents/documentRequests'
import * as source from '@/features/documents/source'
import type { CurateProgress } from '@/contracts/knowledge/types'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
const job = (status: CurateProgress['status']): CurateProgress => ({
  status,
  stage: null,
  completed: 1,
  total: 1,
  generated: 1,
  unchanged: 0,
  message: null,
})
const timeout = () => new ApiError('request timed out', 'timeout')
function workspace() {
  return useDocumentCuration(
    () => 'p',
    documentRequests(() => 'p'),
    (cause, target) => {
      target.value = cause instanceof Error ? cause.message : String(cause)
    },
    { canStart: () => true, selectedId: () => '', setIndex: vi.fn(), refreshDetail: vi.fn() },
  )
}
it('retries only progress reads after a temporary transport failure', async () => {
  const get = vi
    .spyOn(knowledge, 'curateProgress')
    .mockRejectedValueOnce(timeout())
    .mockResolvedValue(job('running'))
  const post = vi.spyOn(knowledge, 'startCurate')
  const pause = vi.fn().mockResolvedValue(undefined)
  await expect(
    reconnectCuration('p', new AbortController().signal, pause, vi.fn()),
  ).resolves.toEqual(job('running'))
  expect(get).toHaveBeenCalledTimes(2)
  expect(post).not.toHaveBeenCalled()
})
it('uses an existing completed job after a start timeout without another POST', async () => {
  const post = vi.spyOn(knowledge, 'startCurate').mockRejectedValue(timeout())
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue(job('done'))
  vi.spyOn(source, 'documentIndex').mockResolvedValue({
    catalog: { project_id: 'p', folders: [], unplaced: 0 },
    entries: [],
  })
  const state = workspace()
  await state.organize()
  expect(post).toHaveBeenCalledTimes(1)
  expect(state.notice.value).toContain('文档整理完成')
  expect(state.noticeError.value).toBe(false)
})
it('keeps a running job alive when its index refresh times out', async () => {
  vi.useFakeTimers()
  const post = vi.spyOn(knowledge, 'startCurate').mockResolvedValue(job('running'))
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue(job('done'))
  vi.spyOn(source, 'documentIndex')
    .mockRejectedValueOnce(timeout())
    .mockResolvedValue({ catalog: { project_id: 'p', folders: [], unplaced: 0 }, entries: [] })
  const state = workspace()
  const pending = state.organize()
  await vi.advanceTimersByTimeAsync(2000)
  await pending
  expect(post).toHaveBeenCalledTimes(1)
  expect(state.notice.value).toContain('文档整理完成')
  expect(state.noticeError.value).toBe(false)
})
it('separates successful server completion from a failed final page refresh', async () => {
  vi.spyOn(knowledge, 'startCurate').mockResolvedValue(job('done'))
  vi.spyOn(source, 'documentIndex').mockRejectedValue(timeout())
  const state = workspace()
  await state.organize()
  expect(state.progress.value?.status).toBe('done')
  expect(state.notice.value).toContain('后台整理已完成')
})
it('stops after bounded read failures without declaring the server job failed', async () => {
  vi.spyOn(knowledge, 'curateProgress').mockRejectedValue(timeout())
  await expect(
    reconnectCuration('p', new AbortController().signal, async () => {}, vi.fn()),
  ).rejects.toThrow('状态')
  expect(knowledge.curateProgress).toHaveBeenCalledTimes(3)
})

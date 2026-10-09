import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { ApiError } from '@/api/client'
import * as source from '@/features/curation/source'
import type { CandidateSummary } from '@/features/curation/types'
import { useCurationReviewEntry } from '@/features/curation/useCurationReviewEntry'

vi.mock('@/features/curation/source', () => ({ entryCandidates: vi.fn() }))
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.resetAllMocks()
})
function row(id: string, created = '2026-10-08T02:00:00Z', project = 'p'): CandidateSummary {
  return {
    id,
    project_id: project,
    state: 'ready',
    target: null,
    created_at: created,
    updated_at: created,
    commands: 1,
    progress: {},
  }
}
function fixture() {
  const project = ref('p'),
    environment = ref('env'),
    route = ref('/projects/p/interfaces')
  const navigate = vi.fn(),
    scope = effectScope()
  scopes.push(scope)
  const entry = scope.run(() =>
    useCurationReviewEntry(
      () => project.value,
      () => environment.value,
      navigate,
      () => route.value,
    ),
  )!
  return { project, environment, route, navigate, entry, scope }
}
it('reads only on demand and shows the requested empty message without navigation', async () => {
  vi.mocked(source.entryCandidates).mockResolvedValue([])
  const f = fixture()
  expect(source.entryCandidates).not.toHaveBeenCalled()
  await f.entry.open()
  expect(f.entry.message.value).toBe('暂无整理结果，请先进行整理文档')
  expect(f.entry.retryable.value).toBe(false)
  expect(f.navigate).not.toHaveBeenCalled()
})
it('opens the result list when only non-reviewable rounds remain and retains the environment', async () => {
  vi.mocked(source.entryCandidates).mockResolvedValue([
    { ...row('applied'), state: 'applied' },
    { ...row('discarded'), state: 'discarded' },
    { ...row('running'), state: 'running' },
    { ...row('interrupted'), state: 'interrupted' },
    row('foreign', '2026-10-10T02:00:00Z', 'q'),
  ])
  const f = fixture()
  await f.entry.open()
  expect(f.navigate).toHaveBeenCalledWith({
    name: 'curation-review',
    params: { projectId: 'p' },
    query: { env: 'env' },
  })
  expect(f.entry.message.value).toBe('')
})
it.each(['ready', 'partial'] as const)(
  'opens a single %s pending round directly',
  async (state) => {
    vi.mocked(source.entryCandidates).mockResolvedValue([{ ...row('pending'), state }])
    const f = fixture()
    f.environment.value = ''
    await f.entry.open()
    expect(f.navigate).toHaveBeenCalledWith({
      name: 'curation-review',
      params: { projectId: 'p', candidateId: 'pending' },
      query: {},
    })
  },
)
it('opens the latest pending round by creation time, ignoring closed, running and foreign rows', async () => {
  vi.mocked(source.entryCandidates).mockResolvedValue([
    { ...row('old'), updated_at: '2026-10-15T02:00:00Z' },
    { ...row('closed-newer', '2026-10-12T02:00:00Z'), state: 'applied' },
    { ...row('running-newer', '2026-10-13T02:00:00Z'), state: 'running' },
    row('foreign', '2026-10-14T02:00:00Z', 'q'),
    { ...row('latest-pending', '2026-10-09T02:00:00Z'), state: 'partial' },
  ])
  const f = fixture()
  await f.entry.open()
  expect(f.navigate).toHaveBeenCalledWith({
    name: 'curation-review',
    params: { projectId: 'p', candidateId: 'latest-pending' },
    query: { env: 'env' },
  })
  expect(f.entry.message.value).toBe('')
})
it('distinguishes lookup failure from an empty result and supports retry', async () => {
  vi.mocked(source.entryCandidates)
    .mockRejectedValueOnce(new ApiError('timeout', 'timeout'))
    .mockResolvedValueOnce([row('result')])
  const f = fixture()
  await f.entry.open()
  expect(f.entry.message.value).toBe('暂时无法读取整理结果，请稍后重试。')
  expect(f.entry.retryable.value).toBe(true)
  expect(f.navigate).not.toHaveBeenCalled()
  await f.entry.open()
  expect(f.navigate).toHaveBeenCalledTimes(1)
  expect(f.entry.message.value).toBe('')
})
it('asks for a project without making an unscoped request', async () => {
  const f = fixture()
  f.project.value = ''
  await f.entry.open()
  expect(f.entry.message.value).toContain('请先进入一个项目')
  expect(source.entryCandidates).not.toHaveBeenCalled()
})
it('ignores late replies after changing project or navigating away', async () => {
  let reply!: (rows: CandidateSummary[]) => void
  vi.mocked(source.entryCandidates).mockImplementation(
    () =>
      new Promise((resolve) => {
        reply = resolve
      }),
  )
  const f = fixture()
  const pending = f.entry.open()
  const signal = vi.mocked(source.entryCandidates).mock.calls[0]![1]!
  f.project.value = 'q'
  f.route.value = '/projects/q/interfaces'
  expect(signal.aborted).toBe(true)
  reply([row('stale')])
  await pending
  expect(f.navigate).not.toHaveBeenCalled()
  expect(f.entry.message.value).toBe('')
})
it('deduplicates repeated clicks and cancels its read when disposed', async () => {
  let reply!: (rows: CandidateSummary[]) => void
  vi.mocked(source.entryCandidates).mockImplementation(
    () =>
      new Promise((resolve) => {
        reply = resolve
      }),
  )
  const f = fixture()
  const pending = f.entry.open()
  await f.entry.open()
  expect(source.entryCandidates).toHaveBeenCalledTimes(1)
  f.scope.stop()
  reply([row('stale')])
  await pending
  expect(f.navigate).not.toHaveBeenCalled()
})
it('reports access denial without offering a misleading empty result or retry', async () => {
  vi.mocked(source.entryCandidates).mockRejectedValue(new ApiError('forbidden', 'http', 403))
  const f = fixture()
  await f.entry.open()
  expect(f.entry.message.value).toBe('没有权限查看当前项目的整理结果。')
  expect(f.entry.retryable.value).toBe(false)
  expect(f.navigate).not.toHaveBeenCalled()
})

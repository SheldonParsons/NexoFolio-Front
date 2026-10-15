import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { api } from '@/api'
import * as source from '@/features/documents/source'
import { projectSource } from '@/features/projects/source'
import { useDocumentWorkspace } from '@/features/documents/useDocumentWorkspace'
import type { DocumentIndex } from '@/features/documents/source'
import * as knowledge from '@/contracts/knowledge/source'
import type { CurateProgress, EndpointDetail } from '@/contracts/knowledge/types'

vi.mock('@/features/projects/source', () => ({ projectSource: { get: vi.fn() } }))

const pid = 'project-1'
const index: DocumentIndex = {
  catalog: { project_id: pid, folders: [], unplaced: 2 },
  entries: ['a', 'b'].map((id, i) => ({
    interface_id: id,
    method: 'GET',
    path: '/api/' + id,
    name: i ? null : '查询组织',
    purpose: null,
    folderId: null,
    summary: {
      id,
      project_id: pid,
      method: 'GET',
      path_template: '/api/' + id,
      declared: false,
      external: false,
      environments: [{ environment_id: 'env-' + id, calls: 1, first_seen: '', last_seen: '' }],
    },
  })),
}
const job = (changes: Partial<CurateProgress> = {}): CurateProgress => ({
  status: 'done',
  stage: null,
  completed: 2,
  total: 2,
  generated: 2,
  unchanged: 0,
  message: null,
  ...changes,
})
beforeEach(() => {
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue(job({ status: 'idle' }))
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mutationWorkspace() {
  vi.spyOn(projectSource, 'get').mockImplementation(async (id) => ({
    project_id: id,
    name: id,
    status: 'doing',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  }))
  vi.spyOn(source, 'environments').mockResolvedValue([
    { id: 'env-a', name: '测试' },
    { id: 'env-b', name: '生产' },
  ])
  const read = vi.spyOn(source, 'documentIndex').mockResolvedValue(index)
  const endpoint: EndpointDetail = {
    facts: {
      summary: index.entries[0]!.summary,
      aliases: [],
      addresses: [],
      fields: [],
      examples: [],
    },
    knowledge: null,
  }
  const detail = vi.spyOn(knowledge, 'endpoint').mockResolvedValue(endpoint)
  const projectId = ref(pid)
  const scope = effectScope()
  const workspace = scope.run(() => useDocumentWorkspace(() => projectId.value, vi.fn()))!
  return { scope, workspace, projectId, read, detail }
}

it('generates a candidate without changing the current document or selected tab', async () => {
  const { scope, workspace, read, detail } = mutationWorkspace()
  const describe = vi
    .spyOn(knowledge, 'describeEndpoint')
    .mockResolvedValue(job({ candidate_id: 'candidate-1', target: 'a' }))
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    await workspace.selectInterface('a')
    workspace.activeTab.value = 'examples'
    read.mockResolvedValue({
      ...index,
      entries: index.entries.map((e) => ({ ...e, name: '新的说明' })),
    })
    await workspace.describe('a')
    expect(describe).toHaveBeenCalledWith(pid, 'a', expect.any(AbortSignal))
    expect(workspace.selectedId.value).toBe('a')
    expect(workspace.activeTab.value).toBe('examples')
    expect(workspace.selectedCard.value?.name).toBe('查询组织')
    expect(detail).toHaveBeenCalledTimes(1)
    expect(workspace.notice.value).toContain('审阅并应用后')
    expect(workspace.reviewPath.value).toBe('/projects/project-1/interfaces/curation/candidate-1')
    expect(read).toHaveBeenCalledTimes(1)
    expect(workspace.busy.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('organizes the whole project while preserving the selected environment and preventing another write', async () => {
  const { scope, workspace } = mutationWorkspace()
  let finish!: (value: CurateProgress) => void
  const organize = vi.spyOn(knowledge, 'startCurate').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const describe = vi.spyOn(knowledge, 'describeEndpoint')
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    workspace.selectEnvironment('env-b')
    const pending = workspace.organize()
    expect(workspace.organizing.value).toBe(true)
    await workspace.describe('b')
    expect(describe).not.toHaveBeenCalled()
    finish(job())
    await pending
    expect(organize).toHaveBeenCalledWith(pid, expect.any(AbortSignal))
    expect(workspace.environmentId.value).toBe('env-b')
    expect(workspace.notice.value).toContain('文档整理完成')
    expect(workspace.busy.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('cancels an old curation and ignores its late reply after switching projects', async () => {
  const { scope, workspace, projectId } = mutationWorkspace()
  let finish!: (value: CurateProgress) => void
  let signal: AbortSignal | undefined
  vi.spyOn(knowledge, 'startCurate').mockImplementation((_pid, requestSignal) => {
    signal = requestSignal
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    const pending = workspace.organize()
    projectId.value = 'new-project'
    await vi.waitFor(() => expect(workspace.project.value?.project_id).toBe('new-project'))
    expect(signal?.aborted).toBe(true)
    finish(job())
    await pending
    expect(workspace.notice.value).toBe('')
    expect(workspace.organizing.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('selects the first environment automatically and switches the shared document by clicks', async () => {
  vi.spyOn(projectSource, 'get').mockResolvedValue({
    project_id: pid,
    name: '订单',
    status: 'doing',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  })
  vi.spyOn(source, 'environments').mockResolvedValue([
    { id: 'env-a', name: '测试' },
    { id: 'env-b', name: '生产' },
  ])
  vi.spyOn(source, 'documentIndex').mockResolvedValue(index)
  const scope = effectScope()
  const workspace = scope.run(() => useDocumentWorkspace(() => pid, vi.fn()))!
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    expect(workspace.environmentId.value).toBe('env-a')
    expect(workspace.visibleEntries.value.map((e) => e.interface_id)).toEqual(['a'])
    workspace.query.value = '组织'
    expect(workspace.sections.value[0]?.entries[0]?.interface_id).toBe('a')
    workspace.selectEnvironment('env-b')
    expect(workspace.query.value).toBe('')
    expect(workspace.visibleEntries.value.map((e) => e.interface_id)).toEqual(['b'])
    expect(source.documentIndex).toHaveBeenCalledTimes(1)
  } finally {
    scope.stop()
  }
})

it('does not let a stale project request replace the newly opened project', async () => {
  let resolveOld!: (value: DocumentIndex) => void
  const pending = new Promise<DocumentIndex>((resolve) => {
    resolveOld = resolve
  })
  vi.spyOn(projectSource, 'get').mockImplementation(async (id) => ({
    project_id: id,
    name: id,
    status: 'doing',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  }))
  vi.spyOn(source, 'environments').mockResolvedValue([{ id: 'env-a', name: '测试' }])
  vi.spyOn(source, 'documentIndex').mockImplementation((id) =>
    id === 'old' ? pending : Promise.resolve(index),
  )
  const project = ref('old')
  const scope = effectScope()
  const workspace = scope.run(() => useDocumentWorkspace(() => project.value, vi.fn()))!
  try {
    project.value = pid
    await vi.waitFor(() => expect(workspace.project.value?.project_id).toBe(pid))
    resolveOld({ ...index, entries: [] })
    await Promise.resolve()
    expect(workspace.visibleEntries.value).toHaveLength(1)
  } finally {
    scope.stop()
  }
})

it('reads one protected index and rejects a response from another project', async () => {
  const request = vi.spyOn(api, 'request').mockResolvedValue(index)
  const result = await source.documentIndex(pid, new AbortController().signal)
  expect(result).toEqual(index)
  expect(request).toHaveBeenCalledTimes(1)
  expect(request).toHaveBeenCalledWith('v1/projects/project-1/document', {
    signal: expect.any(AbortSignal),
    cache: 'no-store',
  })
  request.mockResolvedValue({ ...index, catalog: { ...index.catalog, project_id: 'foreign' } })
  await expect(source.documentIndex(pid, new AbortController().signal)).rejects.toThrow('不匹配')
})

it('shares an index read while independently cancelling consumers and discards completed results', async () => {
  let finish!: (value: DocumentIndex) => void
  const request = vi.spyOn(api, 'request').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const first = new AbortController(),
    second = new AbortController()
  const cancelled = source.documentIndex(pid, first.signal).catch((error) => error)
  const retained = source.documentIndex(pid, second.signal)
  expect(request).toHaveBeenCalledTimes(1)
  first.abort()
  expect(request.mock.calls[0]![1]!.signal!.aborted).toBe(false)
  finish(index)
  expect((await cancelled).name).toBe('AbortError')
  expect(await retained).toEqual(index)
  request.mockResolvedValue(index)
  await source.documentIndex(pid, new AbortController().signal)
  expect(request).toHaveBeenCalledTimes(2)
})

it('follows description progress before directory progress and refreshes partial names', async () => {
  const { scope, workspace, read } = mutationWorkspace()
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    vi.useFakeTimers()
    vi.spyOn(knowledge, 'startCurate').mockResolvedValue(
      job({ status: 'running', stage: 'describe', completed: 0, generated: 0 }),
    )
    vi.mocked(knowledge.curateProgress)
      .mockResolvedValueOnce(
        job({ status: 'running', stage: 'describe', completed: 1, generated: 1 }),
      )
      .mockResolvedValueOnce(
        job({ status: 'running', stage: 'fields', fields_completed: 1, fields_updated: 8 }),
      )
      .mockResolvedValueOnce(job({ status: 'running', stage: 'organize' }))
      .mockResolvedValueOnce(job())
    const pending = workspace.organize()
    await vi.advanceTimersByTimeAsync(0)
    expect(workspace.progressText.value).toBe('正在补全接口说明 0/2')
    await vi.advanceTimersByTimeAsync(2000)
    expect(workspace.progressText.value).toBe('正在补全接口说明 1/2')
    expect(read).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(2000)
    expect(workspace.progressText.value).toBe('正在更新字段知识 1/2')
    await vi.advanceTimersByTimeAsync(2000)
    expect(workspace.progressText.value).toBe('接口与字段知识已更新，正在整理目录')
    await vi.advanceTimersByTimeAsync(2000)
    await pending
    expect(workspace.notice.value).toContain('文档整理完成')
    expect(workspace.busy.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('resumes an active server run on opening the document without starting another', async () => {
  vi.useFakeTimers()
  const start = vi.spyOn(knowledge, 'startCurate')
  vi.mocked(knowledge.curateProgress)
    .mockResolvedValueOnce(
      job({ status: 'running', stage: 'describe', completed: 1, generated: 1 }),
    )
    .mockResolvedValueOnce(job())
  const { scope, workspace } = mutationWorkspace()
  try {
    await vi.advanceTimersByTimeAsync(0)
    expect(workspace.organizing.value).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(workspace.organizing.value).toBe(false)
    expect(start).not.toHaveBeenCalled()
    expect(workspace.notice.value).toContain('文档整理完成')
  } finally {
    scope.stop()
  }
})
it('does not reattach a discarded historical snapshot as the live project task', async () => {
  vi.mocked(knowledge.curateProgress).mockResolvedValue(
    job({ candidate_id: 'old', candidate_state: 'discarded' }),
  )
  const { scope, workspace } = mutationWorkspace()
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    expect(workspace.progress.value).toBeNull()
    expect(workspace.busy.value).toBe(false)
    expect(workspace.notice.value).toBe('')
  } finally {
    scope.stop()
  }
})
it('retains the target round on a failed resume request without marking a new accepted run', async () => {
  const { scope, workspace } = mutationWorkspace()
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    vi.spyOn(knowledge, 'resumeCandidate').mockRejectedValue(new Error('本轮基线已改变'))
    await workspace.fillGaps('selected-round')
    expect(workspace.noticeCandidateId.value).toBe('selected-round')
    expect(workspace.noticeError.value).toBe(true)
    expect(workspace.requestedRunKey.value).toBe('')
  } finally {
    scope.stop()
  }
})

it('keeps the newly selected interface when an older detail request replies late', async () => {
  const { scope, workspace, detail } = mutationWorkspace()
  let oldReply!: (value: EndpointDetail) => void
  const response = (id: string): EndpointDetail => ({
    facts: {
      summary: index.entries.find((entry) => entry.interface_id === id)!.summary,
      aliases: [],
      addresses: [],
      fields: [],
      examples: [],
    },
    knowledge: null,
  })
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    detail.mockImplementation((_pid, id) =>
      id === 'a'
        ? new Promise((resolve) => {
            oldReply = resolve
          })
        : Promise.resolve(response('b')),
    )
    const pending = workspace.selectInterface('a')
    await workspace.selectInterface('b')
    oldReply(response('a'))
    await pending
    expect(workspace.selectedId.value).toBe('b')
    expect(workspace.detail.value?.facts.summary.id).toBe('b')
    expect(workspace.detailLoading.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('ignores a late sample after changing environments even if the source ignores cancellation', async () => {
  const { scope, workspace } = mutationWorkspace()
  let finish!: (value: { observation: unknown }) => void
  const example = vi.spyOn(source, 'example').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    await workspace.selectInterface('a')
    const pending = workspace.selectExample('sample-a')
    const signal = example.mock.calls[0]![3]!
    workspace.selectEnvironment('env-b')
    expect(signal.aborted).toBe(true)
    finish({ observation: { from: 'old-environment' } })
    await pending
    expect(workspace.sample.value).toBeNull()
    expect(workspace.sampleId.value).toBe('')
    expect(workspace.sampleLoading.value).toBe(false)
  } finally {
    scope.stop()
  }
})

it('does not show a late detail error from a previous project', async () => {
  const { scope, workspace, detail, projectId } = mutationWorkspace()
  let fail!: (cause: Error) => void
  try {
    await vi.waitFor(() => expect(workspace.loading.value).toBe(false))
    detail.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject
        }),
    )
    const pending = workspace.selectInterface('a')
    projectId.value = 'new-project'
    await vi.waitFor(() => expect(workspace.project.value?.project_id).toBe('new-project'))
    fail(new Error('old project error'))
    await pending
    expect(workspace.detailError.value).toBe('')
    expect(workspace.detail.value).toBeNull()
  } finally {
    scope.stop()
  }
})

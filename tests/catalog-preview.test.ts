import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { ApiError } from '../src/api/client'
import {
  createPreviewSource,
  type PreviewSource,
  type PreviewPage,
} from '../src/features/catalog-preview/source'
import { previewModel } from '../src/features/catalog-preview/model'
import { useCatalogPreview } from '../src/features/catalog-preview/useCatalogPreview'
import type { PreviewTask } from '../src/contracts/catalog-preview/1.4.0/types.generated'

const projectId = '9568a877-eb48-42ee-acbc-f9217f052386'
const taskId = '1b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const otherId = '2b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const interfaceId = '3b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const firstDirectory = '4b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const secondDirectory = '5b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const fixture = (overrides: Partial<PreviewTask> = {}): PreviewTask => ({
  task_id: taskId,
  candidate_id: otherId,
  contract_version: '1.0.0',
  status: 'ready',
  snapshot_at: '2026-09-15T08:00:00Z',
  snapshot_sha256: 'fixture-hash',
  generation: 1,
  snapshot: {
    project_id: projectId,
    project_name: '测试项目',
    interfaces: [
      {
        interface_id: interfaceId,
        method: 'GET',
        path: '/orders',
        environments: [
          {
            environment_id: firstDirectory,
            environment_name: '测试',
            revision_id: secondDirectory,
            definition: ['arbitrary', null, 1],
          },
        ],
      },
    ],
  },
  candidate: {
    nodes: [
      { id: firstDirectory, name: '订单', description: '', parent: null },
      { id: secondDirectory, name: '查询', description: '', parent: firstDirectory },
    ],
    assignments: [
      {
        interface_id: interfaceId,
        directory_id: secondDirectory,
        reason: '<script>untrusted text</script>',
      },
    ],
  },
  ...overrides,
})
const item = (id = taskId, status: PreviewTask['status'] = 'ready') => ({
  task_id: id,
  candidate_id: otherId,
  status,
  snapshot_at: '2026-09-15T08:00:00Z',
  interface_count: 1,
})
const listPage = (items = [item()], page = 1, total = items.length, limit = 20): PreviewPage => ({
  items,
  total,
  page,
  limit,
})
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}
function setup(source: PreviewSource, id = ref(projectId)) {
  const scope = effectScope()
  scopes.push(scope)
  const unauthorized = vi.fn()
  const state = scope.run(() => useCatalogPreview(() => id.value, source, unauthorized))!
  return { state, scope, unauthorized, id }
}

describe('catalog preview contracts', () => {
  it('validates real schemas including Rust formats and arbitrary JSON definitions', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(listPage([item()], 1, 1, 1))
      .mockResolvedValueOnce({ published: false, task: fixture() })
    const source = createPreviewSource(request)
    const signal = new AbortController().signal
    expect(
      (await source.list(projectId, 1, signal, { status: 'ready', limit: 1 })).items,
    ).toHaveLength(1)
    expect(request.mock.calls[0]?.[0]).toContain('page=1&limit=1&status=ready')
    expect(request.mock.calls[0]?.[1]).toMatchObject({ signal, cache: 'no-store' })
    expect(
      (await source.detail(projectId, taskId, signal)).task.snapshot.interfaces[0]?.environments[0]
        ?.definition,
    ).toEqual(['arbitrary', null, 1])
  })
  it.each(['project', 'task'])('rejects a %s binding mismatch', async (kind) => {
    const value = { published: false, task: fixture() }
    if (kind === 'project') value.task.snapshot.project_id = otherId
    if (kind === 'task') value.task.task_id = otherId
    const source = createPreviewSource(vi.fn().mockResolvedValue(value))
    await expect(
      source.detail(projectId, taskId, new AbortController().signal),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('accepts the current-active published flag in contract 1.3', async () => {
    const source = createPreviewSource(
      vi.fn().mockResolvedValue({ published: true, task: fixture() }),
    )
    expect((await source.detail(projectId, taskId, new AbortController().signal)).published).toBe(
      true,
    )
  })
  it('rejects a status filter ignored by the service', async () => {
    const source = createPreviewSource(
      vi.fn().mockResolvedValue(listPage([item(taskId, 'failed')], 1, 1, 1)),
    )
    await expect(
      source.list(projectId, 1, new AbortController().signal, { status: 'ready', limit: 1 }),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

describe('safe directory representation', () => {
  it('walks a valid tree and preserves model text without evaluating it', () => {
    const model = previewModel(fixture())
    expect(model.flat).toBe(false)
    expect(model.directories.map((row) => row.depth)).toEqual([0, 1])
    expect(model.entries[0]?.assignments[0]?.reason).toBe('<script>untrusted text</script>')
  })
  it('falls back to a finite flat list for cycles and missing assignment targets', () => {
    const task = fixture({ status: 'rejected' })
    task.candidate!.nodes[0]!.parent = secondDirectory
    task.candidate!.assignments[0]!.directory_id = otherId
    const model = previewModel(task)
    expect(model.flat).toBe(true)
    expect(model.directories).toHaveLength(2)
    expect(model.entries[0]?.unclassified).toBe(true)
  })
  it('retains every snapshot interface when assignments are absent', () => {
    const task = fixture({ status: 'pending', candidate: null })
    expect(previewModel(task).entries).toHaveLength(1)
    expect(previewModel(task).entries[0]?.unclassified).toBe(true)
  })
})

describe('candidate selection and request lifetime', () => {
  it('defaults to newest ready across all pages, falling back to newest task only when none are ready', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce(listPage([item(otherId, 'failed')]))
      .mockResolvedValueOnce(listPage([item()], 1, 1, 1))
    const detail = vi.fn().mockResolvedValue({ published: false, task: fixture() })
    const { state } = setup({ list, detail })
    await flush()
    expect(state.selectedTaskId.value).toBe(taskId)
    expect(state.defaultItem.value?.task_id).toBe(taskId)
    expect(detail.mock.calls[0]?.[1]).toBe(taskId)
    list
      .mockResolvedValueOnce(listPage([item(otherId, 'pending')]))
      .mockResolvedValueOnce(listPage([], 1, 0, 1))
    await state.loadPage(1, true)
    expect(state.selectedTaskId.value).toBe(otherId)
  })
  it('ignores a late response after a different task was selected', async () => {
    let release!: (result: { published: false; task: PreviewTask }) => void
    const detail = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve
          }),
      )
      .mockResolvedValue({ published: false, task: fixture({ task_id: otherId }) })
    const { state } = setup({ list: vi.fn().mockResolvedValue(listPage()), detail })
    await flush()
    const oldSignal = detail.mock.calls[0]?.[2] as AbortSignal
    await state.selectTask(otherId)
    release({ published: false, task: fixture() })
    await flush()
    expect(oldSignal.aborted).toBe(true)
    expect(state.task.value?.task_id).toBe(otherId)
  })
  it('aborts on project change and on scope disposal', async () => {
    const list = vi.fn().mockImplementation(() => new Promise(() => {}))
    const { state, id, scope } = setup({ list, detail: vi.fn() })
    const signal = list.mock.calls[0]?.[2] as AbortSignal
    id.value = otherId
    await nextTick()
    expect(signal.aborted).toBe(true)
    const nextSignal = list.mock.calls[1]?.[2] as AbortSignal
    scope.stop()
    expect(nextSignal.aborted).toBe(true)
    expect(state.task.value).toBeNull()
  })
  it.each([401, 403, 404, 503])('shows %i failures without sample fallback', async (status) => {
    const { state, unauthorized } = setup({
      list: vi.fn().mockRejectedValue(new ApiError('failure', 'http', status)),
      detail: vi.fn(),
    })
    await flush()
    expect(state.listError.value).not.toBe('')
    expect(state.task.value).toBeNull()
    expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
  })
})

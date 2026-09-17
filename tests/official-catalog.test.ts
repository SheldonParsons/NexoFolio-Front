import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useOfficialCatalog } from '../src/features/catalog/useOfficialCatalog'
import { ApiError } from '../src/api/client'
import type { CatalogSource, CatalogState } from '../src/features/catalog/types'
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()))
const state: CatalogState = {
  projectId: 'project',
  name: '',
  generation: 0,
  versionId: null,
  sourceTaskId: null,
  unclassifiedId: 'pending',
  total: 1,
  groups: [],
  nodes: [{ id: 'pending', parent: null, name: '待分类', description: '', count: 1, system: true }],
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
  await nextTick()
}
const page = (ids: string[]) => ({
  page: 1,
  limit: 100,
  total: ids.length,
  generation: 0,
  items: ids.map((id) => ({ id, method: 'GET', path: `/${id}`, environments: [] })),
})
function setup(
  current = vi.fn().mockResolvedValue(state),
  interfaces = vi.fn().mockResolvedValue(page(['a'])),
) {
  const scope = effectScope()
  scopes.push(scope)
  const id = ref('project')
  const source: CatalogSource = { current, interfaces, versions: vi.fn(), change: vi.fn() }
  const workspace = scope.run(() => useOfficialCatalog(() => id.value, source, vi.fn()))!
  return { scope, id, source, workspace }
}
describe('current directory read lifecycle', () => {
  it('defaults to the system directory and refreshes new live entries without writing', async () => {
    const { workspace, source } = setup()
    await flush()
    workspace.selectedId.value = 'a'
    vi.mocked(source.interfaces).mockResolvedValue(page(['a', 'new']))
    await workspace.refresh(true)
    expect(workspace.directoryId.value).toBe('pending')
    expect(workspace.list.value?.items.map((item) => item.id)).toEqual(['a', 'new'])
    expect(workspace.selectedId.value).toBe('a')
    expect(source.change).not.toHaveBeenCalled()
  })
  it('ignores a late response after project change and cancels on disposal', async () => {
    let resolve!: (value: CatalogState) => void
    const current = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done
          }),
      )
      .mockResolvedValue({ ...state, projectId: 'other' })
    const { workspace, id, scope } = setup(current)
    const firstSignal = current.mock.calls[0]?.[1] as AbortSignal
    id.value = 'other'
    await flush()
    resolve(state)
    await flush()
    expect(firstSignal.aborted).toBe(true)
    expect(workspace.state.value?.projectId).toBe('other')
    scope.stop()
    expect((current.mock.calls[1]?.[1] as AbortSignal).aborted).toBe(true)
  })
  it('clears mixed-generation rows and waits for a manual refresh on 409', async () => {
    const { workspace, source } = setup()
    await flush()
    vi.mocked(source.interfaces).mockRejectedValue(new ApiError('stale', 'http', 409))
    await workspace.loadInterfaces(1, true)
    expect(workspace.list.value).toBeNull()
    expect(workspace.listError.value).toContain('刷新')
    expect(source.change).not.toHaveBeenCalled()
  })
})

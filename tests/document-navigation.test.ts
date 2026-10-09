import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, reactive, watch } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import fixture from './fixtures/document-navigation.json'
import type { DocumentIndex } from '@/features/documents/source'
import { documentTree, findFolder, folderPath } from '@/features/documents/documentTree'
import {
  documentLocation,
  documentTarget,
  sameDocumentProject,
} from '@/features/documents/documentRoutes'
import { previewCoordinator } from '@/features/documents/useDocumentPreview'
import { useDocumentNavigation } from '@/features/documents/useDocumentNavigation'
import { useDocumentWorkspace } from '@/features/documents/useDocumentWorkspace'
import * as source from '@/features/documents/source'
import * as knowledge from '@/contracts/knowledge/source'
import { projectSource } from '@/features/projects/source'
import { ApiError } from '@/api'
vi.mock('@/features/projects/source', () => ({ projectSource: { get: vi.fn() } }))
const index = fixture as DocumentIndex
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.restoreAllMocks()
})
it('projects two layers with environment counts, keeping targets despite search and absent observations', () => {
  const tree = documentTree(index, 'test-env')
  expect(findFolder(tree, 'root')?.count).toBe(2)
  expect(findFolder(tree, 'child')?.entries).toHaveLength(2)
  expect(folderPath(index.catalog.folders, 'child').map((f) => f.id)).toEqual(['root', 'child'])
  expect(
    findFolder(
      documentTree(index, 'empty-env', 'no-match', { kind: 'endpoint', id: 'endpoint-0' }),
      'child',
    )?.entries.map((e) => e.interface_id),
  ).toEqual(['endpoint-0'])
  expect(
    findFolder(
      documentTree(index, 'empty-env', 'no-match', { kind: 'folder', id: 'empty' }),
      'empty',
    ),
  ).toBeDefined()
  expect(findFolder(documentTree(index, 'empty-env'), 'root')?.count).toBe(1)
})
it('preserves identity after rename and move, tolerates a cyclic parent without recursion', () => {
  const moved = structuredClone(index)
  moved.catalog.folders[1]!.name = '改名'
  moved.catalog.folders[1]!.parent = 'other'
  expect(folderPath(moved.catalog.folders, 'child').map((f) => f.id)).toEqual(['other', 'child'])
  expect(findFolder(documentTree(moved, 'test-env'), 'child')?.entries[0]?.interface_id).toBe(
    'endpoint-0',
  )
  moved.catalog.folders[3]!.parent = 'child'
  expect(documentTree(moved, 'test-env').length).toBeGreaterThan(0)
})
it('shares encoded stable IDs and environment/tab, distinguishing cross-project transitions', async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:projectId/interfaces', name: 'project-interfaces', component: {} },
      {
        path: '/projects/:projectId/interfaces/folders/:folderId',
        name: 'document-folder',
        component: {},
      },
      {
        path: '/projects/:projectId/interfaces/endpoints/:endpointId',
        name: 'document-endpoint',
        component: {},
      },
    ],
  })
  const folder = router.resolve(documentLocation('p', { kind: 'folder', id: 'a/b' }, 'env a'))
  const endpoint = router.resolve(
    documentLocation('p', { kind: 'endpoint', id: 'e' }, 'env a', 'examples'),
  )
  expect(folder.href).toBe('/projects/p/interfaces/folders/a%2Fb?env=env+a')
  expect(documentTarget(folder)).toEqual({ kind: 'folder', id: 'a/b' })
  expect(endpoint.query.tab).toBe('examples')
  expect(sameDocumentProject(folder, endpoint)).toBe(true)
  expect(sameDocumentProject(folder, router.resolve(documentLocation('q', null)))).toBe(false)
})
it('opens immediately, switches ownership synchronously and preserves card-entry grace', () => {
  vi.useFakeTimers()
  const p = previewCoordinator(),
    a = Symbol(),
    b = Symbol()
  p.enter(a)
  expect(p.active.value).toBe(a)
  expect(vi.getTimerCount()).toBe(0)
  p.leave(a)
  vi.advanceTimersByTime(170)
  expect(p.active.value).toBe(a)
  p.keep(a)
  vi.advanceTimersByTime(400)
  expect(p.active.value).toBe(a)
  p.enter(b)
  expect(p.active.value).toBe(b)
  p.leave(a)
  p.cancel(a)
  vi.advanceTimersByTime(500)
  expect(p.active.value).toBe(b)
  p.leave(b)
  vi.advanceTimersByTime(180)
  expect(p.active.value).toBeNull()
  p.enter(a)
  p.cancel(a)
  vi.advanceTimersByTime(500)
  expect(p.active.value).toBeNull()
})
async function setup(path: string) {
  vi.mocked(projectSource.get).mockImplementation(async (id) => ({
    project_id: id,
    name: 'fixture',
    status: 'doing',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  }))
  const read = vi.spyOn(source, 'documentIndex').mockResolvedValue(index)
  vi.spyOn(source, 'environments').mockResolvedValue([
    { id: 'test-env', name: '测试' },
    { id: 'empty-env', name: '空环境' },
  ])
  vi.spyOn(knowledge, 'curateProgress').mockResolvedValue({
    status: 'idle',
    stage: null,
    completed: 0,
    total: 0,
    generated: 0,
    unchanged: 0,
    message: null,
  })
  const endpoint = vi.spyOn(knowledge, 'endpoint').mockImplementation(async (_pid, id) => {
    const entry = index.entries.find((e) => e.interface_id === id || id === 'alias')
    if (!entry) throw new ApiError('missing', 'http', 404)
    return {
      facts: { summary: entry.summary, aliases: [], addresses: [], fields: [], examples: [] },
      knowledge: null,
    }
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/projects/:projectId/interfaces/:kind?/:id?', component: {} },
      { path: '/:projectId?/folder/:folderId', name: 'document-folder', component: {} },
      { path: '/:projectId?/endpoint/:endpointId', name: 'document-endpoint', component: {} },
    ],
  })
  await router.push(path)
  const scope = effectScope()
  scopes.push(scope)
  const route = reactive(router.currentRoute.value)
  router.afterEach((to) => Object.assign(route, to))
  const result = scope.run(() => {
    const workspace = useDocumentWorkspace(
      () => String(route.params.projectId || 'fixture-navigation'),
      vi.fn(),
    )
    const navigation = useDocumentNavigation(workspace, route, router)
    return { workspace, navigation }
  })!
  await vi.waitFor(() => expect(result.workspace.loading.value).toBe(false))
  return { ...result, router, read, endpoint }
}
it('restores direct folder, endpoint and environment selection, reuses index through history', async () => {
  const { workspace, navigation, router, read } = await setup('/folder/child?env=test-env')
  expect(navigation.folder.value?.id).toBe('child')
  await router.push('/endpoint/endpoint-0?env=empty-env&tab=examples')
  await vi.waitFor(() => expect(workspace.detail.value?.facts.summary.id).toBe('endpoint-0'))
  expect(workspace.environmentId.value).toBe('empty-env')
  expect(navigation.activeTab.value).toBe('examples')
  workspace.query.value = 'no-match'
  expect(findFolder(navigation.tree.value, 'child')?.entries[0]?.interface_id).toBe('endpoint-0')
  router.back()
  await vi.waitFor(() => expect(navigation.folder.value?.id).toBe('child'))
  router.forward()
  await vi.waitFor(() => expect(workspace.selectedId.value).toBe('endpoint-0'))
  expect(read).toHaveBeenCalledTimes(1)
})
it('shows invalid environment/folder/endpoint and canonicalizes only a backend alias', async () => {
  const { workspace, navigation, router } = await setup('/folder/missing?env=test-env')
  expect(navigation.folderError.value).toContain('失效')
  await router.push('/endpoint/endpoint-0?env=missing')
  expect(navigation.environmentError.value).toContain('环境已失效')
  expect(workspace.selectedId.value).toBe('')
  await router.push('/endpoint/missing?env=test-env')
  await vi.waitFor(() => expect(workspace.detailError.value).toContain('不存在'))
  await router.push('/endpoint/alias?env=test-env&tab=examples')
  await vi.waitFor(() => expect(router.currentRoute.value.params.endpointId).toBe('endpoint-0'))
  expect(router.currentRoute.value.query).toEqual({ env: 'test-env', tab: 'examples' })
})
it('ignores late detail after navigating to a folder', async () => {
  const { workspace, router, endpoint } = await setup('/folder/child?env=test-env')
  let resolve!: (value: Awaited<ReturnType<typeof knowledge.endpoint>>) => void
  endpoint.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  await router.push('/endpoint/endpoint-0?env=test-env')
  await vi.waitFor(() => expect(workspace.detailLoading.value).toBe(true))
  await router.push('/folder/other?env=test-env')
  resolve({
    facts: {
      summary: index.entries[0]!.summary,
      aliases: [],
      addresses: [],
      fields: [],
      examples: [],
    },
    knowledge: null,
  })
  await Promise.resolve()
  expect(workspace.detail.value).toBeNull()
  expect(workspace.selectedId.value).toBe('')
})

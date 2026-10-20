import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api, ApiError } from '@/api'
import { useDocumentAccess } from '@/features/documents/useDocumentAccess'
import { useDocumentWorkspace } from '@/features/documents/useDocumentWorkspace'
import { useDocumentNavigation } from '@/features/documents/useDocumentNavigation'
import * as documentSource from '@/features/documents/source'
import { useDocumentSelection } from '@/features/documents/useDocumentSelection'
import { documentRequests } from '@/features/documents/documentRequests'
import * as publicSource from '@/features/documents/public/source'
import * as privateSource from '@/contracts/knowledge/source'
import navigation from './fixtures/document-navigation.json'
import type { PublicDocumentIndex, PublicEndpoint } from '@/features/documents/public/source'
vi.mock('@/features/projects/source', () => ({ projectSource: { get: vi.fn() } }))
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.restoreAllMocks()
})
const project = {
  project_id: 'p',
  name: '文档',
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
}
function access(user = '') {
  const scope = effectScope()
  scopes.push(scope)
  const id = ref(user),
    pid = ref('p')
  const state = scope.run(() =>
    useDocumentAccess(
      () => pid.value,
      () => id.value || undefined,
    ),
  )!
  return { state, id, pid }
}
it('keeps guests read-only without probing private data, and downgrades a member immediately on logout', async () => {
  const read = vi.spyOn(api, 'request').mockResolvedValue(project)
  const f = access()
  expect(f.state.mode.value).toBe('public')
  expect(read).not.toHaveBeenCalled()
  f.id.value = 'member'
  await vi.waitFor(() => expect(f.state.mode.value).toBe('member'))
  f.id.value = ''
  expect(f.state.mode.value).toBe('public')
})
it('falls back to public for a denied or unavailable member check and ignores old grants', async () => {
  const read = vi.spyOn(api, 'request').mockRejectedValue(new ApiError('denied', 'http', 403))
  const f = access('outsider')
  await vi.waitFor(() => expect(f.state.mode.value).toBe('public'))
  let resolve!: (value: unknown) => void
  read.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  f.pid.value = 'other'
  expect(f.state.mode.value).toBe('checking')
  f.id.value = ''
  resolve(project)
  await Promise.resolve()
  expect(f.state.mode.value).toBe('public')
})
it('notifies the page when a member loses endpoint permission so write controls can unmount', async () => {
  vi.spyOn(privateSource, 'endpoint').mockRejectedValue(new ApiError('denied', 'http', 403))
  const forbidden = vi.fn()
  const scope = effectScope()
  scopes.push(scope)
  const selection = scope.run(() =>
    useDocumentSelection(
      () => 'p',
      () => 'env',
      documentRequests(() => 'p'),
      vi.fn(),
      forbidden,
    ),
  )!
  await selection.selectInterface('endpoint')
  expect(forbidden).toHaveBeenCalledOnce()
  expect(selection.detail.value).toBeNull()
})
function indexSummary() {
  return navigation.entries[0]!.summary
}
async function reader(path: string) {
  const index = structuredClone(navigation) as unknown as PublicDocumentIndex
  index.project = {
    project_id: 'fixture-navigation',
    name: '公开文档',
    status: 'doing',
    environments: [
      { id: 'test-env', name: '测试' },
      { id: 'empty-env', name: '空环境' },
    ],
  }
  const readIndex = vi.spyOn(publicSource, 'publicIndex').mockResolvedValue(index)
  const readDetail = vi
    .spyOn(publicSource, 'publicEndpoint')
    .mockImplementation(async (pid, endpoint, env) => {
      if (endpoint === 'missing') throw new ApiError('不存在', 'http', 404)
      return {
        facts: {
          summary: {
            ...index.entries[0]!.summary,
            project_id: pid,
            id: endpoint === 'alias' ? 'endpoint-0' : endpoint,
          },
          aliases: [],
          addresses: [],
          fields: [],
          examples: [],
          requests: [],
        },
        knowledge: null,
      }
    })
  const privateRead = vi.spyOn(privateSource, 'endpoint')
  const progressRead = vi.spyOn(privateSource, 'curateProgress')
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
  await router.push(path)
  const route = reactive(router.currentRoute.value)
  router.afterEach((to) => Object.assign(route, to))
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => {
    const workspace = useDocumentWorkspace(
      () => String(route.params.projectId),
      vi.fn(),
      vi.fn(),
      true,
    )
    const navigation = useDocumentNavigation(workspace, route, router)
    return { ...workspace, ...navigation }
  })!
  await vi.waitFor(() => expect(state.loading.value).toBe(false))
  return { state, router, readIndex, readDetail, privateRead, progressRead }
}
it('opens a shared endpoint/environment and navigates folders without any private reads', async () => {
  const f = await reader(
    '/projects/fixture-navigation/interfaces/endpoints/endpoint-0?env=test-env&tab=examples&sample=private',
  )
  await vi.waitFor(() => expect(f.state.detail.value?.facts.summary.id).toBe('endpoint-0'))
  expect(f.readDetail).toHaveBeenCalledWith(
    'fixture-navigation',
    'endpoint-0',
    'test-env',
    expect.any(AbortSignal),
  )
  await f.router.push('/projects/fixture-navigation/interfaces/folders/child?env=test-env')
  expect(f.state.folder.value?.name).toBeTruthy()
  expect(f.state.detail.value).toBeNull()
  expect(f.readIndex).toHaveBeenCalledTimes(1)
  expect(f.privateRead).not.toHaveBeenCalled()
  expect(f.progressRead).not.toHaveBeenCalled()
})
it('rejects invalid environment, reports a missing endpoint, and preserves query on known aliases', async () => {
  const f = await reader('/projects/fixture-navigation/interfaces/endpoints/endpoint-0?env=foreign')
  expect(f.state.environmentError.value).toContain('不属于')
  expect(f.readDetail).not.toHaveBeenCalled()
  await f.router.push('/projects/fixture-navigation/interfaces/endpoints/missing?env=test-env')
  await vi.waitFor(() => expect(f.state.detailError.value).toContain('不存在'))
  await f.router.push('/projects/fixture-navigation/interfaces/endpoints/alias?env=test-env')
  await vi.waitFor(() => expect(f.router.currentRoute.value.params.endpointId).toBe('endpoint-0'))
  expect(f.router.currentRoute.value.query.env).toBe('test-env')
})
it('discards a late endpoint response after navigating back to the public directory', async () => {
  const f = await reader('/projects/fixture-navigation/interfaces')
  let resolve!: (value: PublicEndpoint) => void
  f.readDetail.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  await f.router.push('/projects/fixture-navigation/interfaces/endpoints/endpoint-0?env=test-env')
  await vi.waitFor(() => expect(f.state.detailLoading.value).toBe(true))
  await f.router.push('/projects/fixture-navigation/interfaces/folders/child?env=test-env')
  resolve({
    facts: { summary: indexSummary(), aliases: [], addresses: [], fields: [], examples: [] },
    knowledge: null,
  })
  await Promise.resolve()
  expect(f.state.detail.value).toBeNull()
})

it('rejects a public response bound to a different project', async () => {
  vi.spyOn(api, 'request').mockResolvedValue({
    project_id: 'other',
    endpoint_id: 'endpoint',
    environment_id: 'env',
    fields: [],
  })
  await expect(
    publicSource.publicEndpoint('p', 'endpoint', 'env', new AbortController().signal),
  ).rejects.toMatchObject({ kind: 'invalid-response' })
  vi.mocked(api.request).mockResolvedValue({
    project: { project_id: 'other', environments: [] },
    catalog: { project_id: 'p' },
    entries: [],
  })
  await expect(publicSource.publicIndex('p', new AbortController().signal)).rejects.toMatchObject({
    kind: 'invalid-response',
  })
})

it('read-only workspace exposes full detail and samples without starting curation', async () => {
  const f = await reader(
    '/projects/fixture-navigation/interfaces/endpoints/endpoint-0?env=test-env',
  )
  await vi.waitFor(() => expect(f.state.detail.value?.facts.summary.id).toBe('endpoint-0'))
  const sample = vi
    .spyOn(documentSource, 'example')
    .mockResolvedValue({ observation: { request: { body: 'captured' } } })
  const start = vi.spyOn(privateSource, 'startCurate'),
    describe = vi.spyOn(privateSource, 'describeEndpoint')
  await f.state.selectExample('sample')
  expect(f.state.sample.value).toEqual({ request: { body: 'captured' } })
  expect(sample).toHaveBeenCalledWith(
    'fixture-navigation',
    'endpoint-0',
    'sample',
    expect.any(AbortSignal),
    true,
  )
  await f.state.organize()
  await f.state.describe('endpoint-0')
  expect(start).not.toHaveBeenCalled()
  expect(describe).not.toHaveBeenCalled()
  expect(f.progressRead).not.toHaveBeenCalled()
})

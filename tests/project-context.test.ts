import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectContextStore } from '@/stores/projectContext'
import { navigationProject } from '@/features/navigation/navigationProject'
import { documentLocation } from '@/features/documents/documentRoutes'
import type { RouteLocationNormalized } from 'vue-router'
import type { Project } from '@/features/projects/types'

const allowed = (id: string, name = `项目 ${id}`): Project => ({
  project_id: id,
  name,
  can_access: true,
  access_state: 'allowed',
  status: 'doing',
  reason_code: null,
})
let saved: Map<string, string>
beforeEach(() => {
  setActivePinia(createPinia())
  saved = new Map()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  })
})
afterEach(() => vi.unstubAllGlobals())

it('retains the entered project and environment on project-list and documentation routes', () => {
  const store = useProjectContextStore()
  store.remember('backend:user', allowed('p', '商用订单'), 'test-env')
  const routes: Pick<RouteLocationNormalized, 'params' | 'query'>[] = [
    { params: {}, query: {} },
    { params: { docSlug: 'mcp' }, query: { env: 'unrelated' } },
  ]
  for (const route of routes) {
    const result = navigationProject(route, store.current)!
    expect(result).toEqual({ projectId: 'p', name: '商用订单', environmentId: 'test-env' })
    expect(documentLocation(result.projectId, null, result.environmentId)).toEqual({
      name: 'project-interfaces',
      params: { projectId: 'p' },
      query: { env: 'test-env' },
    })
  }
})
it('prioritizes an explicit project route without borrowing another project name or environment', () => {
  const store = useProjectContextStore()
  store.remember('backend:user', allowed('a'), 'a-env')
  expect(navigationProject({ params: { projectId: 'b' }, query: {} }, store.current)).toEqual({
    projectId: 'b',
    name: '',
    environmentId: '',
  })
  expect(
    navigationProject({ params: { projectId: 'a' }, query: { env: 'chosen' } }, store.current)
      ?.environmentId,
  ).toBe('chosen')
})
it('updates environment and project name but resets environment when entering another project', () => {
  const store = useProjectContextStore()
  store.remember('backend:user', allowed('a'), 'first')
  store.remember('backend:user', allowed('a', '新名称'), 'second')
  store.remember('backend:user', allowed('a', '新名称'))
  expect(store.current).toEqual({ projectId: 'a', name: '新名称', environmentId: 'second' })
  store.remember('backend:user', allowed('b'))
  expect(store.current?.environmentId).toBe('')
})
it('restores only the same backend-user context after a reload and clears it on logout', () => {
  useProjectContextStore().remember('backend:user-a', allowed('a'), 'env')
  setActivePinia(createPinia())
  const store = useProjectContextStore()
  store.activate('backend:user-b')
  expect(store.current).toBeNull()
  store.activate('other-backend:user-a')
  expect(store.current).toBeNull()
  store.activate('backend:user-a')
  expect(store.current?.projectId).toBe('a')
  store.clear()
  store.activate('backend:user-a')
  expect(store.current).toBeNull()
})
it('never replaces the selected project with a denied or unconfirmed project', () => {
  const store = useProjectContextStore()
  store.remember('backend:user', allowed('a'))
  store.remember('backend:user', { ...allowed('b'), can_access: false, access_state: 'denied' })
  store.remember('backend:user', { ...allowed('b'), access_state: 'unknown' })
  expect(store.current?.projectId).toBe('a')
})
it('handles unavailable or malformed storage while keeping in-memory navigation usable', () => {
  const store = useProjectContextStore()
  saved.set('nexofolio.active-project.v1:backend%3Auser', '{broken')
  store.activate('backend:user')
  expect(store.current).toBeNull()
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('blocked')
    },
    setItem: () => {
      throw new Error('blocked')
    },
    removeItem: () => {
      throw new Error('blocked')
    },
  })
  store.remember('backend:user', allowed('a'), 'env')
  expect(store.current?.projectId).toBe('a')
  expect(() => store.clear()).not.toThrow()
})

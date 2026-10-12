import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import { installTelemetry, pageContext, clientProblem } from '../src/features/audit/telemetry'
import { canViewAudit } from '../src/features/audit/access'

describe('fixed audit account', () => {
  it.each(['a80646', 'A80646'])('allows %s regardless of case', (account) => {
    expect(
      canViewAudit({
        id: 'fixture',
        account,
        display_name: '',
        enabled: true,
        can_manage_projects: true,
      }),
    ).toBe(true)
  })
  it.each([undefined, null, '', 'other', 'A806460', 'a80646 ', 'Ａ80646'])(
    'rejects a different or missing account: %s',
    (account) => {
      expect(
        canViewAudit(
          account == null
            ? account
            : {
                id: 'fixture',
                account,
                display_name: '',
                enabled: true,
                can_manage_projects: true,
              },
        ),
      ).toBe(false)
    },
  )
})

vi.mock('../src/api/session', () => ({ readCredential: () => null }))
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('bounded page and problem telemetry', () => {
  it('keeps only route identity and valid resource IDs, never query or hash', () => {
    const route = {
      name: 'product-docs',
      params: { docSlug: 'mcp', projectId: 'secret' },
      query: { token: 'secret' },
      hash: '#secret',
    }
    expect(pageContext(route)).toEqual({
      route: 'product-docs:mcp',
      project: undefined,
      resource: undefined,
    })
    expect(pageContext({ name: 'audit', params: {} })).toBeNull()
  })
  it('records initial home once, ignores query-only navigation, caps errors and contains delivery failures', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', new EventTarget())
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetcher)
    let after: (
      to: RouteLocationNormalizedLoaded,
      from: RouteLocationNormalizedLoaded,
      failure?: unknown,
    ) => void = () => {}
    const current = {
      name: 'home',
      params: {},
      path: '/',
      matched: [{}],
    } as RouteLocationNormalizedLoaded
    const router = {
      currentRoute: { value: current },
      afterEach: (callback: typeof after) => {
        after = callback
      },
      onError: () => {},
    } as unknown as Router
    installTelemetry({ config: {} } as App, router)
    after(current, { ...current, matched: [] })
    await vi.runAllTimersAsync()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({ kind: 'page', route: 'home' })
    after(current, current)
    await vi.runAllTimersAsync()
    expect(fetcher).toHaveBeenCalledTimes(1)
    for (let i = 0; i < 15; i++) {
      clientProblem('JS_ERROR')
      await vi.advanceTimersByTimeAsync(1)
    }
    expect(fetcher).toHaveBeenCalledTimes(11)
    expect(fetcher.mock.calls.every((call) => !call[1].body.includes('offline'))).toBe(true)
  })
})

describe('primary page visit identities', () => {
  it.each([
    [{ name: 'home', params: {} }, { route: 'home' }],
    [{ name: 'projects', params: {} }, { route: 'projects' }],
    [{ name: 'product-docs', params: {} }, { route: 'product-docs:philosophy' }],
    [{ name: 'product-docs', params: { docSlug: 'api' } }, { route: 'product-docs:api' }],
    [
      { name: 'product-docs', params: { docSlug: 'retirement' } },
      { route: 'product-docs:retirement' },
    ],
    [
      { name: 'product-docs', params: { docSlug: 'private-unknown-slug' } },
      { route: 'product-docs:unknown' },
    ],
  ])('records a bounded readable page identity', (route, expected) => {
    expect(pageContext(route)).toMatchObject(expected)
    expect(JSON.stringify(pageContext(route))).not.toContain('private-unknown-slug')
  })
  it.each(['document-folder', 'document-endpoint', 'curation-review'])(
    'preserves project and resource identity for %s',
    (name) => {
      const project = '10000000-0000-4000-8000-000000000001',
        resource = '10000000-0000-4000-8000-000000000002'
      const param =
        name === 'document-folder'
          ? 'folderId'
          : name === 'document-endpoint'
            ? 'endpointId'
            : 'candidateId'
      expect(pageContext({ name, params: { projectId: project, [param]: resource } })).toEqual({
        route: name,
        project,
        resource,
      })
    },
  )
})

describe('readable page and request metrics', () => {
  it('keeps the primary page groups explicit', async () => {
    const { pageCategory } = await import('../src/features/audit/analysis')
    expect(pageCategory('home')).toBe('首页')
    expect(pageCategory('projects')).toBe('项目页')
    expect(pageCategory('project-interfaces')).toBe('项目页')
    for (const route of [
      'document-folder',
      'document-endpoint',
      'product-docs:mcp',
      'product-docs:api',
    ])
      expect(pageCategory(route)).toBe('文档页')
    expect(pageCategory('curation-review')).toBe('其他页面')
  })
  it('does not label background queries as logins, downloads, successful rounds, or tool calls', async () => {
    const { accessTitle } = await import('../src/features/audit/analysis')
    const row = {
      kind: 'api' as const,
      project: '',
      resource: '',
      action: 'request',
      method: 'GET',
      route: '/v1/auth/me',
    }
    expect(accessTitle(row)).toContain('不是登录次数')
    expect(accessTitle({ ...row, route: '/v1/downloads' })).toContain('不是下载次数')
    expect(accessTitle({ ...row, route: '/v1/sites/lookup' })).toContain('触发来源未记录')
    expect(accessTitle({ ...row, route: '/mcp' })).toContain('不是工具调用次数')
    expect(accessTitle({ ...row, route: '/v1/projects/{project}/curate' })).toBe('整理进度查询')
    expect(
      accessTitle({ ...row, route: '/v1/projects/{project}/curate', method: 'POST' }),
    ).toContain('不代表成功轮次')
  })
})

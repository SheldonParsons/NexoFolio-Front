// Synthetic, fail-closed API interception. No business data or writes reach a backend.
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const id = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const source = { project_id: id(1), name: '云售后 · 禅道项目', status: 'doing' }
const projects = Array.from({ length: 25 }, (_, n) => ({
  project_id: id(n + 1),
  name:
    n === 24 ? '远端匹配项目' : n === 0 ? source.name : `业务项目 ${String(n).padStart(2, '0')}`,
  status: 'doing',
  origin: n === 0 ? 'zentao' : 'local',
  permission_sources: n === 0 ? [] : [source],
}))
const event = {
  at: '2026-10-11T08:00:00Z',
  kind: 'operation',
  action: 'project.updated',
  actor: `user:${id(90)}`,
  route: '/v1/project-management/projects/{project_id}',
  method: 'PATCH',
  status: 200,
  duration_ms: 8,
  request_id: id(80),
  project: id(2),
  resource: '',
  code: 'OK',
}
const report = {
  actors: { [event.actor]: 'Sheldon（模拟）' },
  events: [event],
  buckets: [
    {
      key: 'fixture',
      hour: event.at,
      kind: 'page',
      actor: event.actor,
      route: 'projects',
      method: 'BROWSER',
      status: 0,
      hits: 12,
      duration_ms: 0,
      max_duration_ms: 0,
      project: id(2),
    },
  ],
  summary: [{ route: 'projects', hits: 12, actors: 1 }],
  storage: { events: 1, buckets: 1, bytes: 8192, evicted_events: 0, evicted_buckets: 0 },
  health: {
    enabled: true,
    dropped_access: 2,
    dropped_important: 0,
    storage_failures: 0,
    queued_access: 0,
    queued_important: 0,
  },
  limits: { events: 100000, buckets: 100000, access_days: 30, error_days: 30, operation_days: 90 },
}
const rowSet = (items) => ({
  items,
  recorded: items.length,
  included: items.length,
  truncated: false,
})
const diagnostic = {
  schema_version: 1,
  generated_at: event.at,
  project: { id: id(2), name: projects[1].name },
  candidate: {
    id: id(70),
    project_id: id(2),
    target: null,
    state: 'partial',
    status: 'gaps',
    created_at: event.at,
    updated_at: event.at,
    stage: 'fields',
    run_id: id(71),
    completed: 4,
    total: 6,
    fields_failed: 2,
    issue_count: 1,
  },
  timing: {
    started_at: event.at,
    attempt_started_at: event.at,
    last_progress_at: event.at,
    heartbeat_at: event.at,
  },
  counts: {
    completed: 4,
    total: 6,
    fields_failed: 2,
    fields_completed: 45,
    fields_total: 47,
    fields_pending: 2,
    retries: 3,
    attempts: 1,
  },
  preparation: { samples_unavailable: 1 },
  attempts: rowSet([
    { run_id: id(71), started_at: event.at, ended_at: '2026-10-11T08:02:00Z', outcome: 'partial' },
  ]),
  activities: rowSet([
    { at: event.at, stage: 'fields', kind: 'retry', batch: 2, elapsed_ms: 5000 },
  ]),
  issues: rowSet([
    { endpoint: id(60), stage: 'fields', code: 'RATE_LIMITED', fields: 2, retryable: true },
  ]),
  batches: rowSet([
    { id: id(72), state: 'complete', stage: 'fields', model: 'fixture-model', commands: 8 },
  ]),
  operations: rowSet([]),
  related_events: rowSet([
    {
      at: event.at,
      kind: 'operation',
      action: 'curation.finished',
      request_id: id(80),
      code: 'PARTIAL',
    },
  ]),
  coverage: {
    source: 'persisted_candidate',
    activity_history: 'latest 80',
    event_total: 1,
    event_included: 1,
    events_available: true,
    unknown_fields: ['provider_request_id'],
    redacted_fields: ['samples'],
    note: 'bounded',
  },
  agent_prompt: '请根据证据排查这一轮整理，不要猜测未记录字段。',
}
const analytics = {
  items: [],
  total: 1,
  matching_visits: 250,
  page: 1,
  limit: 20,
  precision: 'event',
  projects: { [id(2)]: projects[1].name },
  resources: { [id(60)]: '售后单查询' },
  actors: report.actors,
  coverage: {
    detail_recording_started_at: event.at,
    retained_from: event.at,
    retained_until: event.at,
    stored_details: 251,
    capacity_evictions: 0,
    hourly_buckets: 1,
    hourly_evictions: 0,
  },
  health: report.health,
  retention: { days: 30, max_details: 100000 },
}
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = [],
  errors = []
async function fixture(role = 'admin', viewport = { width: 1440, height: 960 }, theme = 'light') {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  await ctx.addInitScript(
    ({ role, theme }) => {
      if (role !== 'anonymous')
        localStorage.setItem(
          'nexofolio.session',
          JSON.stringify({
            token: role,
            expiresAt: role === 'expired' ? '2020-01-01T00:00:00Z' : '2099-01-01T00:00:00Z',
          }),
        )
      localStorage.setItem('nexofolio.theme', theme)
      localStorage.setItem(
        'nexofolio.user',
        JSON.stringify({ account: 'A80646', enabled: true, can_manage_projects: true }),
      )
    },
    { role, theme },
  )
  let capability = true,
    revoked = false,
    failList = false
  const calls = []
  await ctx.route(`${origin}/api/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, ''),
      method = req.method()
    calls.push({ path, method, query: url.search })
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    const token = req.headers().authorization?.replace('Bearer ', '')
    const admin = ['admin', 'lowercase', 'disabled', 'no-capability'].includes(token)
    if (path === '/v1/telemetry') return route.fulfill({ status: 204 })
    if (path === '/v1/auth/me')
      return revoked
        ? send({}, 401)
        : send({
            user: {
              id: id(admin ? 90 : 91),
              account: admin ? (token === 'lowercase' ? 'a80646' : 'A80646') : 'member',
              display_name: 'Sheldon（模拟）',
              enabled: token !== 'disabled',
            },
            capabilities: capability && token !== 'no-capability' ? { manage_projects: true } : {},
          })
    if (path === '/v1/projects')
      return send({
        items: projects
          .map((p) => ({ ...p, can_access: true, access_state: 'allowed', reason_code: null }))
          .slice(0, 10),
        total: 25,
        page: 1,
        limit: 10,
      })
    if (path === '/v1/project-management/projects' && method === 'GET') {
      if (!admin || !capability || revoked) return send({}, 404)
      if (failList) return send({ error: { message: '模拟列表读取失败' } }, 503)
      const q = url.searchParams.get('q') || '',
        kind = url.searchParams.get('origin'),
        page = Number(url.searchParams.get('page')),
        limit = Number(url.searchParams.get('limit'))
      const items = projects.filter((p) => p.name.includes(q) && (!kind || p.origin === kind))
      return send({
        items: items.slice((page - 1) * limit, page * limit),
        total: items.length,
        page,
        limit,
      })
    }
    if (path === '/v1/audit/access') {
      if (!admin || !capability || revoked) return send({}, 404)
      const kind = url.searchParams.get('kind') || 'page',
        view = url.searchParams.get('view')
      const rank = {
        kind,
        project: id(2),
        resource: id(60),
        route:
          kind === 'page'
            ? 'document-endpoint'
            : kind === 'mcp'
              ? '/mcp'
              : '/v1/projects/{project}/endpoints/{endpoint}',
        action: kind === 'mcp' ? 'read_interface' : 'page.view',
        method: kind === 'page' ? 'BROWSER' : 'GET',
        hits: 250,
        users: 1,
        visitor_ips: 2,
        unknown_visits: 0,
        last_at: event.at,
      }
      return send({
        ...analytics,
        items:
          view === 'visits'
            ? [
                {
                  ...rank,
                  at: event.at,
                  actor: event.actor,
                  request_id: id(80),
                  status: 200,
                  code: 'OK',
                  duration_ms: 8,
                },
              ]
            : [rank],
        total: view === 'visits' ? 250 : 1,
        precision: 'event',
      })
    }
    if (path === `/v1/audit/curations/${id(2)}`)
      return send({
        items: [diagnostic.candidate],
        limit: 100,
        scope: 'latest_100',
        note: '最近100轮',
      })
    if (path === `/v1/audit/curations/${id(2)}/${id(70)}`) return send(diagnostic)
    if (path === '/v1/audit') return admin && capability && !revoked ? send(report) : send({}, 403)
    if (path === '/v1/project-management/permission-sources')
      return send({ items: [source], total: 1, page: 1, limit: 100 })
    if (path === `/v1/project-management/projects/${id(2)}` && method === 'GET')
      return send({
        project_id: id(2),
        name: projects[1].name,
        revision: 1,
        permission_sources: [source],
      })
    assert.ok(
      !['POST', 'PATCH', 'DELETE', 'PUT'].includes(method),
      `Unexpected write blocked: ${method} ${path}`,
    )
    return send({ error: { message: '合成场景未提供此资料' } }, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return {
    ctx,
    page,
    calls,
    revoke: () => {
      capability = false
    },
    expire: () => {
      revoked = true
    },
    fail: () => {
      failList = true
    },
    recover: () => {
      failList = false
    },
  }
}
const settled = async (page) => {
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  await page.evaluate(() => document.fonts.ready)
}
const shot = async (page, name) => {
  await settled(page)
  await page.screenshot({ path: new URL(name, evidence).pathname })
}
try {
  for (const role of ['anonymous', 'member', 'disabled', 'expired', 'no-capability']) {
    const f = await fixture(role)
    for (const path of ['/management/projects', '/management/audit', '/settings/audit']) {
      await f.page.goto(origin + path)
      await settled(f.page)
      assert.equal(await f.page.locator('.management-entry,.management-layout').count(), 0)
      assert.equal(
        f.calls.filter((c) => c.path.startsWith('/v1/project-management') || c.path === '/v1/audit')
          .length,
        0,
      )
    }
    results.push({ scenario: `direct-route-and-spoofed-storage-${role}`, passed: true })
    await f.ctx.close()
  }
  const f = await fixture('lowercase'),
    p = f.page
  await p.goto(origin + '/management')
  await p.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  await settled(p)
  assert.equal(new URL(p.url()).pathname, '/management/projects')
  await p.getByText('共 25 个项目', { exact: true }).waitFor()
  await p.getByRole('button', { name: '下一页', exact: true }).click()
  await p.getByRole('link', { name: '远端匹配项目', exact: true }).waitFor()
  await p.getByRole('searchbox', { name: '搜索全部可管理项目' }).fill('远端匹配')
  await p.getByRole('button', { name: '查询', exact: true }).click()
  await p.getByText('共 1 个项目', { exact: true }).waitFor()
  assert.ok(f.calls.some((c) => c.query.includes('q=') && c.query.includes('page=1')))
  await p.getByRole('searchbox', { name: '搜索全部可管理项目' }).fill('')
  f.fail()
  await p.getByRole('button', { name: '查询', exact: true }).click()
  await p.getByRole('alert').getByText('模拟列表读取失败', { exact: false }).waitFor()
  f.recover()
  await p.getByRole('button', { name: '重试', exact: true }).click()
  await p.getByText('共 25 个项目', { exact: true }).waitFor()
  await shot(p, 'console-desktop.png')
  await p.getByRole('link', { name: '内容审计', exact: true }).click()
  await p.getByRole('heading', { name: '内容审计', exact: true }).waitFor()
  await settled(p)
  await p.getByRole('alert').getByText('采集或保留范围存在缺口', { exact: false }).waitFor()
  assert.equal(await p.locator('select:visible').count(), 0)
  await p.getByRole('button', { name: '查看访问', exact: true }).click()
  await p.getByRole('dialog').getByText('Sheldon（模拟）', { exact: true }).waitFor()
  await shot(p, 'audit-detail.png')
  await p.keyboard.press('Escape')
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await p.getByRole('combobox', { name: '访问范围', exact: true }).click()
  await p.getByRole('option', { name: 'MCP 读取', exact: true }).click()
  await p.getByRole('button', { name: '查询', exact: true }).click()
  await p.getByRole('heading', { name: 'MCP 读取热点', exact: true }).waitFor()
  await shot(p, 'audit-desktop.png')
  await p.getByRole('tab', { name: '整理排查', exact: true }).click()
  await p.getByRole('combobox', { name: '项目', exact: true }).click()
  await p.getByRole('option', { name: projects[1].name, exact: true }).click()
  await p.getByRole('button', { name: /存在缺口/ }).click()
  await p.getByRole('button', { name: '一键复制排查资料', exact: true }).waitFor()
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedDiagnostic = text
        },
      },
    })
  })
  await p.getByRole('button', { name: '一键复制排查资料', exact: true }).click()
  await p.getByRole('status').getByText('排查资料已复制，可直接交给 Agent。').waitFor()
  assert.ok((await p.evaluate(() => window.copiedDiagnostic)).includes('RATE_LIMITED'))
  assert.ok((await p.evaluate(() => window.copiedDiagnostic)).includes(id(70)))
  await shot(p, 'curation-diagnostic.png')
  await p.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied')
        },
      },
    })
  })
  await p.getByRole('button', { name: '一键复制排查资料', exact: true }).click()
  await p.getByRole('textbox', { name: '可手动复制的排查资料', exact: true }).waitFor()
  assert.ok(
    (
      await p.getByRole('textbox', { name: '可手动复制的排查资料', exact: true }).inputValue()
    ).includes('RATE_LIMITED'),
  )
  results.push({ scenario: 'hotspot-exact-visit-and-curation-copy-success-failure', passed: true })
  await p.goto(origin + '/settings/audit')
  await p.getByRole('heading', { name: '内容审计', exact: true }).waitFor()
  assert.equal(new URL(p.url()).pathname, '/management/audit')
  await p.getByRole('link', { name: '项目管理', exact: true }).click()
  await p.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  await settled(p)
  await p.goBack()
  await p.getByRole('heading', { name: '内容审计', exact: true }).waitFor()
  await settled(p)
  await p.goForward()
  await p.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  await p.reload()
  await p.getByText('共 25 个项目', { exact: true }).waitFor()
  for (const path of [
    '/',
    '/docs/mcp',
    '/projects',
    `/projects/${id(2)}/interfaces`,
    `/projects/${id(2)}/interfaces/curation`,
  ]) {
    await p.goto(origin + path)
    await settled(p)
    await p.locator('.management-entry').waitFor()
    const geometry = await p.locator('.management-entry').boundingBox()
    assert.ok(geometry.y + geometry.height <= 960.1)
  }
  results.push({
    scenario: 'case-insensitive-entry-all-layouts-pagination-search-failure-audit-history-refresh',
    passed: true,
  })
  await p.goto(origin + '/management/projects')
  await p.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  await settled(p)
  await p.getByRole('button', { name: '编辑项目', exact: true }).first().click()
  await p.getByRole('dialog').waitFor()
  await p.keyboard.press('Escape')
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await p.goto(origin + '/management/audit')
  await p.getByText('采集范围与完整性', { exact: true }).waitFor()
  await settled(p)
  f.revoke()
  await p.getByRole('combobox', { name: '项目', exact: true }).fill('云售后')
  await p.locator('.management-layout').waitFor({ state: 'hidden' })
  assert.equal(await p.locator('.management-entry').count(), 0)
  results.push({ scenario: 'open-session-server-capability-revocation', passed: true })
  await f.ctx.close()
  const switched = await fixture(),
    sp = switched.page
  await sp.goto(origin + '/management/projects')
  await sp.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  await sp.evaluate(() => {
    localStorage.setItem(
      'nexofolio.session',
      JSON.stringify({ token: 'member', expiresAt: '2099-01-01T00:00:00Z' }),
    )
    window.dispatchEvent(new StorageEvent('storage', { key: 'nexofolio.session' }))
  })
  await sp.locator('.management-layout').waitFor({ state: 'hidden' })
  assert.equal(await sp.locator('.management-entry').count(), 0)
  results.push({ scenario: 'cross-tab-account-switch-clears-private-content', passed: true })
  await switched.ctx.close()
  const expired = await fixture(),
    ep = expired.page
  await ep.goto(origin + '/management/projects')
  await ep.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
  expired.expire()
  await ep.evaluate(() => window.dispatchEvent(new Event('focus')))
  await ep.locator('.management-entry').waitFor({ state: 'hidden' })
  results.push({ scenario: 'expired-server-session-clears-entry', passed: true })
  await expired.ctx.close()
  for (const [theme, viewport] of [
    ['dark', { width: 1440, height: 960 }],
    ['light', { width: 390, height: 844 }],
    ['dark', { width: 390, height: 844 }],
  ]) {
    const visual = await fixture('admin', viewport, theme),
      v = visual.page
    await v.goto(origin + '/management/projects')
    await v.getByRole('link', { name: projects[1].name, exact: true }).waitFor()
    await shot(v, `console-${theme}-${viewport.width}.png`)
    assert.equal(await v.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await v.getByRole('button', { name: '编辑项目', exact: true }).first().click()
    await v.getByRole('checkbox', { name: source.name, exact: true }).waitFor()
    await shot(v, `drawer-${theme}-${viewport.width}.png`)
    const bounds = await v.getByRole('dialog').boundingBox()
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1)
    await v.keyboard.press('Escape')
    await v.getByRole('dialog').waitFor({ state: 'hidden' })
    await v.getByRole('link', { name: '内容审计', exact: true }).click()
    await v.getByText('采集范围与完整性', { exact: true }).waitFor()
    await shot(v, `audit-${theme}-${viewport.width}.png`)
    assert.equal(await v.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await v.getByRole('tab', { name: '整理排查', exact: true }).click()
    await v.getByRole('combobox', { name: '项目', exact: true }).click()
    await v.getByRole('option', { name: projects[1].name, exact: true }).click()
    await v.getByRole('button', { name: /存在缺口/ }).click()
    await v.getByRole('button', { name: '一键复制排查资料', exact: true }).scrollIntoViewIfNeeded()
    await shot(v, `diagnostic-${theme}-${viewport.width}.png`)
    assert.equal(await v.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    results.push({ scenario: `visual-${theme}-${viewport.width}`, passed: true })
    await visual.ctx.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('console-results.json', evidence),
    JSON.stringify({ results, errors }, null, 2),
  )
  console.log(JSON.stringify({ results, errors }, null, 2))
} finally {
  await browser.close()
}

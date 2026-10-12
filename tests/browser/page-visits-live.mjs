// Real browser -> disposable API -> PostgreSQL -> analysis. Only unrelated downloads and business writes are blocked.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const {
  chromium,
} = require('/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fixture = JSON.parse(await readFile(process.env.AUDIT_BROWSER_FIXTURE, 'utf8'))
const origin = process.env.PAGE_AUDIT_ORIGIN || 'http://127.0.0.1:5182'
assert.equal(new URL(origin).hostname, '127.0.0.1')
const evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const delivered = [],
  errors = [],
  blocked = []
execFileSync(
  '/opt/homebrew/bin/psql',
  [
    '-h',
    '127.0.0.1',
    '-p',
    '25434',
    '-d',
    'nexofolio_access_test_page_visits',
    '-v',
    'ON_ERROR_STOP=1',
    '-Atqc',
    'TRUNCATE audit.events,audit.access_events,audit.buckets RESTART IDENTITY; UPDATE audit.counters SET events=0,buckets=0,access_events=0,evicted_events=0,evicted_buckets=0,evicted_access_events=0,access_details_since=now()',
  ],
  { stdio: 'pipe' },
)
const start = new Date().toISOString()
async function context(user) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    reducedMotion: 'reduce',
  })
  if (user)
    await ctx.addInitScript(
      (token) =>
        localStorage.setItem(
          'nexofolio.session',
          JSON.stringify({ token, expiresAt: '2099-01-01T00:00:00Z' }),
        ),
      user.token,
    )
  await ctx.route(`${origin}/api/**`, async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname
    if (path === '/api/v1/downloads')
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Unrelated download lookup disabled in isolated acceptance' },
        }),
      })
    if (!['GET', 'HEAD'].includes(req.method()) && path !== '/api/v1/telemetry') {
      blocked.push({ method: req.method(), path })
      return route.abort('blockedbyclient')
    }
    await route.continue()
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (response) => {
    if (new URL(response.url()).pathname === '/api/v1/telemetry') {
      const body = response.request().postDataJSON()
      if (body?.kind === 'page')
        delivered.push({
          role: user ? user.id : 'anonymous',
          ...body,
          status: response.status(),
          request_id: response.headers()['x-request-id'],
        })
    }
  })
  return { ctx, page }
}
async function nav(page, route, action) {
  try {
    await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === '/api/v1/telemetry' &&
          r.request().postDataJSON()?.kind === 'page' &&
          r.request().postDataJSON()?.route === route,
      ),
      action(),
    ])
    await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  } catch (error) {
    await page.screenshot({ path: new URL('page-visits-failure.png', evidence).pathname })
    console.log(
      JSON.stringify(
        {
          expected: route,
          url: page.url(),
          links: await page
            .locator('a[href*="/interfaces/"]')
            .evaluateAll((links) =>
              links.map((a) => ({ href: a.getAttribute('href'), text: a.textContent })),
            ),
          errors,
          blocked,
        },
        null,
        2,
      ),
    )
    throw error
  }
}
async function analysis(ctx, params = {}) {
  const q = new URLSearchParams({ kind: 'page', limit: '100', since: start, ...params })
  const response = await ctx.request.get(`${origin}/api/v1/audit/access?${q}`, {
    headers: { Authorization: `Bearer ${fixture.admin.token}` },
  })
  assert.equal(response.status(), 200)
  return response.json()
}
try {
  const anon = await context(),
    ap = anon.page
  await nav(ap, 'home', () => ap.goto(origin + '/'))
  await nav(ap, 'home', () => ap.reload())
  await nav(ap, 'product-docs:philosophy', () => ap.goto(origin + '/docs'))
  await nav(ap, 'product-docs:mcp', () =>
    ap.locator('nav[aria-label="文档目录"] a[href="/docs/mcp"]').click(),
  )
  await nav(ap, 'product-docs:api', () =>
    ap.locator('nav[aria-label="文档目录"] a[href="/docs/api"]').click(),
  )
  await nav(ap, 'product-docs:unknown', () => ap.goto(origin + '/docs/no-such-public-guide'))
  await nav(ap, 'document-folder', () =>
    ap.goto(`${origin}/projects/${fixture.project}/interfaces/folders/${fixture.folder}`),
  )
  await nav(ap, 'document-endpoint', () =>
    ap.goto(`${origin}/projects/${fixture.project}/interfaces/endpoints/${fixture.endpoints[0]}`),
  )
  await anon.ctx.close()
  const member = await context(fixture.member),
    p = member.page
  await nav(p, 'projects', () => p.goto(origin + '/projects'))
  await p.getByRole('button', { name: '页面审计验收项目', exact: true }).waitFor()
  await nav(p, 'project-interfaces', () =>
    p.getByRole('button', { name: '页面审计验收项目', exact: true }).click(),
  )
  await p.getByRole('combobox', { name: '项目环境', exact: true }).click()
  await p.getByRole('option', { name: '合成测试环境', exact: true }).click()
  await p.waitForURL((url) => url.searchParams.get('env') === fixture.environment)
  await nav(p, 'document-folder', () =>
    p
      .locator(`a[href^="/projects/${fixture.project}/interfaces/folders/${fixture.folder}"]`)
      .first()
      .click(),
  )
  await nav(p, 'document-endpoint', () =>
    p
      .locator(
        `a[href^="/projects/${fixture.project}/interfaces/endpoints/${fixture.endpoints[0]}"]`,
      )
      .first()
      .click(),
  )
  await nav(p, 'document-endpoint', () =>
    p
      .locator(
        `a[href^="/projects/${fixture.project}/interfaces/endpoints/${fixture.endpoints[1]}"]`,
      )
      .first()
      .click(),
  )
  const beforeQuery = delivered.length,
    env = p.getByRole('combobox', { name: '项目环境', exact: true })
  await env.waitFor()
  const current = await env.innerText()
  await env.click()
  await p
    .getByRole('option', {
      name: current.includes('另一测试环境') ? '合成测试环境' : '另一测试环境',
      exact: true,
    })
    .click()
  await p.waitForURL((url) => url.searchParams.has('env'))
  await p.evaluate(async (project) => {
    location.hash = 'audit-query-only-check'
    const token = JSON.parse(localStorage.getItem('nexofolio.session')).token
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`/api/v1/projects/${project}/curate/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error('isolated polling failed')
    }
  }, fixture.project)
  await p.waitForTimeout(300)
  assert.equal(delivered.length, beforeQuery, 'environment/hash/polling must not add page views')
  await member.ctx.close()
  const admin = await context(fixture.admin)
  let report
  for (let i = 0; i < 25; i++) {
    report = await analysis(admin.ctx)
    if (report.matching_visits === delivered.length) break
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  assert.equal(report.matching_visits, delivered.length)
  const stored = JSON.parse(
    execFileSync(
      '/opt/homebrew/bin/psql',
      [
        '-h',
        '127.0.0.1',
        '-p',
        '25434',
        '-d',
        'nexofolio_access_test_page_visits',
        '-Atqc',
        `SELECT coalesce(json_agg(json_build_object('route',route,'actor',actor,'project',project,'resource',resource,'at',at,'request_id',data->>'request_id') ORDER BY id),'[]') FROM audit.access_events WHERE kind='page' AND at>='${start}'::timestamptz`,
      ],
      { encoding: 'utf8' },
    ),
  )
  assert.equal(stored.length, delivered.length)
  for (const event of delivered) {
    assert.equal(event.status, 204)
    const persisted = stored.find((row) => row.request_id === event.request_id)
    assert.ok(persisted, `missing persisted page event ${event.route}`)
    assert.equal(persisted.route, event.route)
    assert.equal(
      persisted.actor,
      event.role === 'anonymous' ? 'ip:127.0.0.1' : `user:${event.role}`,
    )
  }
  const counts = {}
  for (const group of ['home', 'projects', 'docs']) {
    const data = await analysis(admin.ctx, { page_group: group })
    counts[group] = data.matching_visits
    assert.ok(data.items.length > 0)
  }
  assert.deepEqual(counts, { home: 2, projects: 2, docs: 9 })
  assert.equal(report.projects[fixture.project], '页面审计验收项目')
  assert.equal(report.resources[fixture.folder], '合成业务目录')
  assert.equal(report.resources[fixture.endpoints[0]], '合成接口 1')
  const views = await analysis(admin.ctx, { view: 'visits', resource: fixture.endpoints[0] })
  assert.equal(views.actors[`user:${fixture.member.id}`], 'page-audit-member')
  assert.ok(views.items.some((row) => row.actor === 'ip:127.0.0.1'))
  const methodReport = await analysis(admin.ctx, {
    kind: 'api',
    background: 'true',
    route: '/v1/projects/{project}/curate/candidates',
  })
  assert.ok(methodReport.matching_visits >= 3)
  const hiddenPoll = await analysis(admin.ctx, {
    kind: 'api',
    route: '/v1/projects/{project}/curate/candidates',
  })
  assert.equal(hiddenPoll.matching_visits, 0)
  await admin.page.goto(origin + '/management/audit')
  await admin.page
    .locator('.audit-page-groups')
    .getByRole('button', { name: '首页', exact: true })
    .click()
  await admin.page.getByRole('button', { name: '首页', exact: true }).first().waitFor()
  await admin.page.getByText('2 次已记录浏览', { exact: false }).waitFor()
  await admin.page.screenshot({ path: new URL('page-visits-home-live.png', evidence).pathname })
  await admin.page.getByRole('button', { name: '文档页', exact: true }).click()
  await admin.page.getByRole('button', { name: 'MCP 使用指南', exact: true }).waitFor()
  await admin.page.screenshot({ path: new URL('page-visits-docs-live.png', evidence).pathname })
  await admin.page.getByRole('button', { name: '业务接口文档 · 合成接口 1', exact: true }).click()
  await admin.page.getByRole('dialog').getByText('page-audit-member', { exact: true }).waitFor()
  await admin.page.getByRole('dialog').getByText('访客 IP 127.0.0.1', { exact: true }).waitFor()
  await admin.page.screenshot({ path: new URL('page-visits-detail-live.png', evidence).pathname })
  assert.deepEqual(errors, [])
  assert.deepEqual(blocked, [])
  await writeFile(
    new URL('page-visits-live-result.json', evidence),
    JSON.stringify(
      {
        environment: 'disposable local Vite -> real API -> PostgreSQL',
        frontend: origin,
        api: 'http://127.0.0.1:18182',
        production_deployed: false,
        business_database_touched: false,
        delivered,
        stored,
        group_counts: counts,
        exact_api_page_count: report.matching_visits,
        query_hash_and_polling_add_page_views: false,
        backend_poll_requests: methodReport.matching_visits,
        errors,
        blocked,
      },
      null,
      2,
    ),
  )
  console.log(
    JSON.stringify(
      {
        persisted_page_visits: stored.length,
        group_counts: counts,
        anonymous_and_verified_user: true,
        real_resource_names: true,
        query_hash_and_polling_ignored: true,
        errors,
        blocked,
      },
      null,
      2,
    ),
  )
  await admin.ctx.close()
} finally {
  await browser.close()
}

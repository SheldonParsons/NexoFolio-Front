// UI-only read fixtures; all API traffic intercepted.
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url),
  {
    chromium,
  } = require('/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173',
  evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
let mode = 'empty'
const calls = [],
  errors = []
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript(() =>
    localStorage.setItem(
      'nexofolio.session',
      JSON.stringify({ token: 'synthetic-admin', expiresAt: '2099-01-01T00:00:00Z' }),
    ),
  )
  await ctx.route(`${origin}/api/**`, (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.endsWith('/telemetry')) return route.fulfill({ status: 204 })
    assert.equal(req.method(), 'GET')
    if (path.endsWith('/auth/me'))
      return send({
        user: {
          id: 'fixture-admin',
          account: 'A80646',
          display_name: '同一测试用户',
          enabled: true,
        },
        capabilities: { manage_projects: true },
      })
    if (path.endsWith('/project-management/projects'))
      return send({ items: [], total: 0, page: 1, limit: 20 })
    if (path.endsWith('/audit/access')) {
      const view = url.searchParams.get('view')
      calls.push(view)
      assert.ok(['ranking', 'visits'].includes(view))
      if (mode === 'failure') return send({ error: { message: '模拟审计读取失败' } }, 503)
      const row = {
        kind: url.searchParams.get('kind'),
        project: '',
        resource: '',
        route: '/v1/test',
        action: 'request',
        method: 'GET',
      }
      return send({
        items:
          mode === 'empty'
            ? []
            : mode === 'unknown'
              ? [{}]
              : [view === 'visits' ? { ...row, at: 'invalid-date' } : { ...row, hits: 1 }],
        total: mode === 'empty' ? 0 : 1,
        matching_visits: mode === 'empty' ? 0 : undefined,
        page: 1,
        limit: 20,
        coverage: {},
      })
    }
    return send({}, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(origin + '/management/audit')
  await page.getByText('当前范围暂无访问记录。', { exact: true }).waitFor()
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('alert').count(), 0)
  assert.equal(await page.getByText('查看历史小时汇总', { exact: true }).count(), 0)
  await page.getByText('采集范围与完整性', { exact: true }).click()
  await page.getByText('保留期限未记录', { exact: false }).waitFor()
  await page.screenshot({ path: new URL('current-audit-empty.png', evidence).pathname })
  mode = 'unknown'
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await page.getByRole('button', { name: '访问类型未记录', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '查看访问', exact: true }).isDisabled(), true)
  await page.getByText('访问总数未记录', { exact: false }).waitFor()
  await page.screenshot({ path: new URL('current-audit-missing-fields.png', evidence).pathname })
  mode = 'detail'
  await page.getByRole('combobox', { name: '访问范围', exact: true }).click()
  await page.getByRole('option', { name: 'NexoFolio 后台 API', exact: true }).click()
  await page.getByRole('button', { name: '查看访问', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('未知访问身份', { exact: true }).waitFor()
  await dialog.getByText('结果未记录', { exact: true }).waitFor()
  await dialog.getByText('未记录', { exact: true }).first().waitFor()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  mode = 'failure'
  await page.getByRole('button', { name: '查询', exact: true }).click()
  await page.getByRole('alert').getByText('模拟审计读取失败', { exact: false }).waitFor()
  assert.equal(await page.getByText('当前范围暂无访问记录。', { exact: true }).count(), 0)
  mode = 'empty'
  await page.getByRole('button', { name: '重试', exact: true }).click()
  await page.getByText('当前范围暂无访问记录。', { exact: true }).waitFor()
  assert.equal(await page.getByRole('alert').count(), 0)
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('current-audit-result.json', evidence),
    JSON.stringify(
      {
        scenarios: ['empty', 'missing-fields', 'missing-detail-fields', 'read-failure-and-retry'],
        calls,
        errors,
        passed: true,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ passed: true, calls, errors }))
} finally {
  await browser.close()
}

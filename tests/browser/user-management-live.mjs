// Real API and disposable PostgreSQL fixture; no intercepted responses or user mutations.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const {
  chromium,
} = require('/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const meta = JSON.parse(await readFile('/tmp/nexofolio-users-live-control.json', 'utf8'))
assert.equal(new URL(meta.origin).hostname, '127.0.0.1')
assert.ok(path.basename(meta.private).startsWith('nexofolio-users-live.'))
const fixture = JSON.parse(await readFile(meta.fixture, 'utf8'))
const evidence = new URL('../../docs/reviews/user-management-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const checks = [],
  errors = [],
  writes = []
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
async function context(token, extra = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    ...extra,
  })
  if (token)
    await ctx.addInitScript(
      (token) =>
        localStorage.setItem(
          'nexofolio.session',
          JSON.stringify({ token, expiresAt: '2099-01-01T00:00:00Z' }),
        ),
      token,
    )
  return ctx
}
async function ready(page) {
  await page.getByRole('heading', { name: '用户管理', exact: true }).waitFor()
  await page.locator('.management-users-table tbody tr').first().waitFor()
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
}
async function query(page, text) {
  await page.getByRole('searchbox', { name: '姓名或账号', exact: true }).fill(text)
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname.endsWith('/v1/user-management/users')),
    page.getByRole('button', { name: '查询', exact: true }).click(),
  ])
  assert.equal(response.status(), 200)
  return response.json()
}
try {
  const url = `${meta.api}/v1/user-management/users`
  const headers = { Authorization: `Bearer ${fixture.user.token}` }
  const response = await fetch(url, { headers })
  assert.equal(response.status, 200)
  assert.ok(response.headers.get('cache-control').includes('no-store'))
  const before = await response.json()
  assert.equal(before.total, fixture.expected_total)
  for (const token of [null, fixture.member.token]) {
    const denied = await fetch(`${url}?page=invalid`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    assert.equal(denied.status, 404)
  }
  checks.push(
    'real registered-user API is instance scoped, read only, no-store and hidden from ordinary/anonymous users',
  )
  const ctx = await context(fixture.user.token)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    if (
      r.url().startsWith(meta.origin + '/api/') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) &&
      !r.url().includes('/telemetry')
    )
      writes.push({ method: r.method(), path: new URL(r.url()).pathname })
  })
  await page.goto(meta.origin + '/management/users')
  await ready(page)
  assert.equal(
    await page
      .getByRole('navigation', { name: '管理中心', exact: true })
      .getByRole('link', { name: '用户管理', exact: true })
      .getAttribute('aria-current'),
    'page',
  )
  assert.equal(await page.locator('.management-users-table tbody tr').count(), 20)
  assert.equal(await page.locator('.management-users-table button').count(), 0)
  const avatar = page
    .locator('tr')
    .filter({ hasText: '林澄' })
    .locator('.management-user-avatar img')
  await avatar.waitFor()
  assert.ok(await avatar.evaluate((img) => img.complete && img.naturalWidth === 512))
  const broken = page
    .locator('tr')
    .filter({ hasText: '头像损坏示例' })
    .locator('.management-user-avatar')
  await page.waitForFunction(() =>
    [...document.querySelectorAll('tr')]
      .find((r) => r.textContent.includes('头像损坏示例'))
      ?.querySelector('.management-user-avatar')
      ?.textContent.includes('头'),
  )
  assert.equal(await broken.locator('img').isVisible(), false)
  await page
    .locator('.management-main')
    .screenshot({ path: new URL('users-light.png', evidence).pathname })
  checks.push(
    'private menu, 20-user first page, real stored avatar and missing/broken-avatar fallback render without user actions',
  )
  const [second] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/v1/user-management/users?') &&
        new URL(r.url()).searchParams.get('page') === '2',
    ),
    page.getByRole('button', { name: '下一页', exact: true }).click(),
  ])
  assert.equal((await second.json()).items.length, 8)
  await page.waitForFunction(
    () => document.querySelectorAll('.management-users-table tbody tr').length === 8,
  )
  const matched = await query(page, '林澄')
  assert.equal(matched.total, 1)
  assert.equal(matched.page, 1)
  await page.waitForFunction(
    () => document.querySelectorAll('.management-users-table tbody tr').length === 1,
  )
  const empty = await query(page, 'not-a-user')
  assert.equal(empty.total, 0)
  await page.getByText('没有找到匹配的用户', { exact: true }).waitFor()
  await page
    .locator('.management-main')
    .screenshot({ path: new URL('users-empty.png', evidence).pathname })
  checks.push('real server pagination, name search, first-page reset and empty state work')
  await query(page, '')
  await ready(page)
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click()
  await page
    .locator('.management-main')
    .screenshot({ path: new URL('users-dark.png', evidence).pathname })
  const mobileCtx = await context(fixture.user.token, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const mobile = await mobileCtx.newPage()
  mobile.on('pageerror', (e) => errors.push(e.message))
  await mobile.goto(meta.origin + '/management/users')
  await ready(mobile)
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.equal(await mobile.getByRole('link', { name: '用户管理', exact: true }).isVisible(), true)
  await mobile.screenshot({ path: new URL('users-mobile.png', evidence).pathname, fullPage: true })
  checks.push('dark theme and 390px mobile layout remain readable with no horizontal overflow')
  for (const token of [null, fixture.member.token]) {
    const deniedCtx = await context(token)
    const denied = await deniedCtx.newPage()
    let reads = 0
    denied.on('request', (r) => {
      if (r.url().includes('/v1/user-management/users')) reads++
    })
    await denied.goto(meta.origin + '/management/users')
    await denied.waitForURL((u) => !u.pathname.startsWith('/management'))
    assert.equal(reads, 0)
    assert.equal(await denied.locator('.management-users-table').count(), 0)
    await deniedCtx.close()
  }
  checks.push(
    'anonymous and ordinary browser sessions cannot mount the page or issue directory reads',
  )
  const after = await (await fetch(url, { headers })).json()
  assert.deepEqual(after, before)
  assert.deepEqual(writes, [])
  assert.deepEqual(errors, [])
  checks.push(
    'browsing does not change users, profiles or login timestamps; no business writes or model calls',
  )
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify(
      {
        status: 'passed',
        real_api: true,
        mocked_responses: false,
        model_calls: 0,
        checks,
        page_errors: errors,
        document_writes: writes,
      },
      null,
      2,
    ) + '\n',
  )
  console.log('PASS', JSON.stringify(checks))
} catch (error) {
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify(
      { status: 'failed', checks, error: String(error.stack ?? error), page_errors: errors },
      null,
      2,
    ) + '\n',
  )
  throw error
} finally {
  await browser.close()
}

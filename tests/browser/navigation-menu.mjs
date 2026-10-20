// Real application rendering, with every API response intercepted and synthetic.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN
const evidence = process.env.NAVIGATION_EVIDENCE
assert(origin?.startsWith('http://127.0.0.1:') && !origin.endsWith(':5173'))
assert(evidence?.startsWith('/tmp/nexofolio-navigation-'))
await mkdir(evidence, { recursive: true })
const fixture = JSON.parse(
  await readFile(new URL('../fixtures/navigation-menu.json', import.meta.url), 'utf8'),
)
const projects = fixture.names.map((name, i) => ({
  project_id: `p${i + 1}`,
  name,
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
}))
const rows = [
  ...projects,
  ...['denied', 'unknown'].map((state) => ({
    ...projects[0],
    project_id: state,
    name: state,
    can_access: false,
    access_state: state,
  })),
]
const scope = `${origin}/api:live:${fixture.user.id}`
const historyKey = `nexofolio.recent-projects.v1:${encodeURIComponent(scope)}`
const checks = [],
  requests = [],
  errors = [],
  unexpected = []
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
async function session(visits = fixture.visits, theme = 'light', failRecent = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(
    ({ visits, theme, scope, historyKey, fixture }) => {
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token: 'synthetic-navigation', expiresAt: '2099-01-01T00:00:00Z' }),
      )
      localStorage.setItem(historyKey, JSON.stringify(visits))
      localStorage.setItem('nexofolio.theme', theme)
      sessionStorage.setItem(
        `nexofolio.active-project.v1:${encodeURIComponent(scope)}`,
        JSON.stringify({ projectId: 'p1', name: fixture.names[0], environmentId: '' }),
      )
    },
    { visits, theme, scope, historyKey, fixture },
  )
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (url.origin !== origin) {
      unexpected.push(request.url())
      return route.abort()
    }
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const path = url.pathname.slice(4)
    requests.push({ method: request.method(), path: path + url.search })
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/v1/telemetry') return route.fulfill({ status: 204 })
    if (request.method() !== 'GET') {
      unexpected.push(`${request.method()} ${path}`)
      return send({}, 405)
    }
    if (path === '/v1/auth/me') return send({ user: fixture.user })
    if (path === '/v1/auth/profile')
      return send({
        user: fixture.user,
        account_display_name: fixture.user.display_name,
        display_name_override: null,
        bio: '',
        version: 1,
        created_at: '2026-01-01T00:00:00Z',
        last_login_at: '2026-10-20T00:00:00Z',
      })
    if (path === '/v1/downloads')
      return send({
        schema_version: 1,
        desktop_channel: url.searchParams.get('desktop_channel') || 'internal',
        fetcher_channel: url.searchParams.get('fetcher_channel') || 'internal',
        fetcher: { status: 'unpublished', release: null },
        desktop: ['windows', 'mac-arm64', 'mac-x64'].map((platform) => ({
          platform,
          status: 'unpublished',
          release: null,
        })),
      })
    if (path === '/v1/projects') {
      if (failRecent && url.searchParams.has('ids'))
        return send({ error: { message: 'synthetic offline' } }, 503)
      const ids = url.searchParams.get('ids')?.split(',')
      const items = rows.filter((p) => !ids || ids.includes(p.project_id))
      return send({
        items,
        total: items.length,
        page: 1,
        limit: Number(url.searchParams.get('limit')),
      })
    }
    const match = path.match(/^\/v1\/projects\/(p[1-6])(.*)$/)
    if (match) {
      const project = projects.find((p) => p.project_id === match[1])
      if (!match[2]) return send(project)
      if (match[2] === '/environments') return send({ items: [], total: 0, page: 1, limit: 100 })
      if (match[2] === '/document')
        return send({
          catalog: { project_id: project.project_id, folders: [], unplaced: 0 },
          entries: [],
        })
      if (match[2] === '/curate')
        return send({
          status: 'idle',
          stage: null,
          completed: 0,
          total: 0,
          generated: 0,
          unchanged: 0,
          message: null,
        })
      if (['/curate/tasks', '/curate/candidates'].includes(match[2])) return send([])
    }
    unexpected.push(path)
    return send({ error: { message: 'unhandled synthetic path' } }, 404)
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}/projects`)
  await page.locator('.project-results[aria-busy="false"]').waitFor()
  await page.waitForFunction(() => !document.querySelector('.app-viewport[inert]'))
  return { context, page }
}
const trigger = (page, name) => page.getByRole('button', { name, exact: true })
async function openMenu(page, name) {
  await page.mouse.move(0, 0)
  await trigger(page, name).hover()
  await page.waitForFunction(
    (name) =>
      [...document.querySelectorAll('.workspace-navigation-trigger')].some(
        (el) => el.textContent.trim() === name && el.dataset.state === 'open',
      ),
    name,
  )
  await page.waitForTimeout(350) // Let the existing viewport transition settle before geometry/screenshots.
}
async function geometry(page, selector) {
  const result = await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect()
    return {
      x: rect.x,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      overflow: el.scrollWidth > el.clientWidth + 1,
      viewport: innerWidth,
    }
  })
  assert(result.x >= 0 && result.right <= result.viewport + 1, JSON.stringify(result))
  assert.equal(result.overflow, false, JSON.stringify(result))
  return result
}
async function screenshot(page, name) {
  await page.screenshot({ path: `${evidence}/${name}.png` })
  if (['projects-light', 'interfaces-light', 'projects-dark', 'interfaces-dark'].includes(name))
    await page
      .locator('.workspace-navigation-viewport')
      .screenshot({ path: `${evidence}/${name}-menu.png` })
}
try {
  const { context, page } = await session()
  await page.waitForFunction(() => document.querySelector('.group-count')?.textContent === '5')
  const history = await page.evaluate((key) => localStorage.getItem(key), historyKey)
  const before = requests.length
  await openMenu(page, '项目空间')
  assert.deepEqual(
    await page
      .locator('.navigation-recent-link > [data-navigation-project-name]')
      .allTextContents(),
    fixture.names.slice(0, 4),
  )
  assert.equal(await page.locator('.navigation-recent-link[aria-current="true"]').count(), 1)
  assert.equal(await page.locator('.navigation-recent-link [data-icon="check"]').count(), 1)
  assert.equal(await page.locator('.navigation-brand-card').count(), 1)
  const projectGeometry = await geometry(page, '.navigation-project-panel')
  assert(projectGeometry.height <= 310, JSON.stringify(projectGeometry))
  await screenshot(page, 'projects-light')
  await page.locator('.navigation-recent-link').nth(1).hover()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.navigation-project-tooltip').count(), 0)
  const hover = await page
    .locator('.navigation-recent-link')
    .nth(1)
    .evaluate((el) => {
      const previous = el.closest('li').previousElementSibling.querySelector('button')
      return {
        gap: el.getBoundingClientRect().top - previous.getBoundingClientRect().bottom,
        icon: el.querySelector('.navigation-recent-icon [data-icon]').getAttribute('data-icon'),
        animation: getComputedStyle(el.querySelector('.project-hover-cell')).animationPlayState,
        width: el.getBoundingClientRect().width,
        availableWidth: el.closest('ul').clientWidth,
      }
    })
  assert(hover.gap >= 4)
  assert.equal(hover.icon, 'folder-open')
  assert.equal(hover.animation, 'running, running')
  assert(hover.width <= hover.availableWidth + 1)
  checks.push({ name: 'independent-row-background-folder-and-cell-motion', ...hover })
  await screenshot(page, 'short-name-hover')
  await page.mouse.move(0, 0)
  await page.locator('.navigation-recent-link').nth(1).focus()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.navigation-project-tooltip').count(), 0)
  await page.locator('.navigation-recent-link').first().focus()
  await page.locator('.navigation-recent-link').first().hover()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.navigation-project-tooltip').count(), 0)
  await screenshot(page, 'recent-long-name-no-popup')
  await page.keyboard.press('Escape')
  await openMenu(page, '项目空间')
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), historyKey), history)
  assert.equal(requests.length, before, 'hover must reuse the list and never query each project')
  checks.push({ name: 'top-four-list-five-deduplicated-filtered-reuse', projectGeometry })

  await openMenu(page, '接口文档')
  const contextGeometry = await geometry(page, '.navigation-selected-project')
  assert.equal(contextGeometry.height, 36)
  assert(
    await page
      .locator('.navigation-selected-project strong')
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  )
  assert.equal(
    await page.getByRole('link', { name: /正式文档/ }).getAttribute('href'),
    '/projects/p1/interfaces',
  )
  assert.equal(
    await page.getByRole('link', { name: /MCP 凭证/ }).getAttribute('href'),
    '/settings/mcp',
  )
  assert.equal(await page.getByRole('button', { name: /整理结果/ }).count(), 1)
  await screenshot(page, 'interfaces-light')
  await page.locator('.navigation-selected-project strong').hover()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.navigation-project-tooltip').count(), 0)
  await screenshot(page, 'context-long-name-no-popup')
  await page.keyboard.press('Escape')
  await page.mouse.move(0, 0)
  await trigger(page, '接口文档').focus()
  await page.keyboard.press('Enter')
  assert.equal(await trigger(page, '接口文档').getAttribute('aria-expanded'), 'true')
  await page.keyboard.press('ArrowDown')
  await page.locator('.navigation-selected-project').waitFor()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  assert.equal(await trigger(page, '接口文档').getAttribute('aria-expanded'), 'false')
  assert.equal(
    await trigger(page, '接口文档').evaluate((el) => el === document.activeElement),
    true,
  )
  checks.push({ name: 'compact-context-existing-links-keyboard-escape-focus', contextGeometry })

  for (const width of [1024, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const name of ['项目空间', '接口文档']) {
      await openMenu(page, name)
      const bounds = await geometry(
        page,
        name === '项目空间' ? '.navigation-project-panel' : '.navigation-interfaces-panel',
      )
      await screenshot(page, `${name === '项目空间' ? 'projects' : 'interfaces'}-${width}`)
      checks.push({ name: `${name}-${width}`, bounds })
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMenu(page, '项目空间')
  assert.equal(
    await page
      .locator('.workspace-navigation-viewport')
      .evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  )
  checks.push({ name: 'reduced-motion' })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('.navigation-recent-link').nth(1).click()
  await page.waitForURL(`${origin}/projects/p2/interfaces`)
  await page.waitForFunction(() => !document.querySelector('.app-viewport[inert]'))
  await openMenu(page, '项目空间')
  assert.equal(
    (
      await page
        .locator('.navigation-recent-link > [data-navigation-project-name]')
        .allTextContents()
    )[0],
    '云售后',
  )
  assert.equal(
    await page
      .locator('.navigation-recent-link[aria-current="true"] > [data-navigation-project-name]')
      .textContent(),
    '云售后',
  )
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), historyKey)
  assert.equal(after[0].id, 'p2')
  assert.equal(after.filter((v) => v.id === 'p2').length, 1)
  checks.push({ name: 'click-existing-entry-and-refresh-history-after-navigation' })
  await context.close()

  const dark = await session(fixture.visits, 'dark')
  for (const name of ['项目空间', '接口文档']) {
    await openMenu(dark.page, name)
    await screenshot(dark.page, name === '项目空间' ? 'projects-dark' : 'interfaces-dark')
  }
  assert.equal(await dark.page.locator('html').getAttribute('data-theme'), 'dark')
  checks.push({ name: 'dark-theme' })
  await dark.context.close()
  for (const count of [0, 1, 2, 3]) {
    const small = await session(fixture.visits.filter((v) => /^p[1-3]$/.test(v.id)).slice(0, count))
    await openMenu(small.page, '项目空间')
    assert.equal(await small.page.locator('.navigation-recent-link').count(), count)
    if (!count)
      assert.equal(
        await small.page.locator('.navigation-recent-empty').textContent(),
        '访问项目后会显示在这里。',
      )
    await screenshot(small.page, `projects-${count}-visits`)
    checks.push({ name: `${count}-visits-no-empty-rows` })
    await small.context.close()
  }
  const failed = await session([{ id: 'not-in-list', visitedAt: 123 }], 'light', true)
  await openMenu(failed.page, '项目空间')
  await failed.page.getByText('最近项目暂不可用，请从全部项目查看。', { exact: true }).waitFor()
  assert.equal(await failed.page.locator('.navigation-recent-link').count(), 0)
  assert.equal(
    (await failed.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), historyKey)).length,
    1,
  )
  await screenshot(failed.page, 'projects-failed')
  await failed.context.close()
  checks.push({ name: 'transient-error-retains-history' })
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  console.log(JSON.stringify({ checks: checks.length, errors, evidence }))
} finally {
  await writeFile(
    `${evidence}/browser-results.json`,
    JSON.stringify({ checks, requests, errors, unexpected }, null, 2),
  )
  await browser.close()
}

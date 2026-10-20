// Reads a dedicated synthetic API fixture. Never targets the user's development API.
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const evidence = process.env.PROJECT_BROWSER_EVIDENCE
assert(evidence?.startsWith('/tmp/nexofolio-project-browser-'))
const fixture = JSON.parse(await readFile(`${evidence}/fixture.json`, 'utf8'))
const origin = process.env.PROJECT_BROWSER_ORIGIN
assert(origin?.startsWith('http://127.0.0.1:') && !origin.endsWith(':5173'))
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'no-preference',
})
const id = (n) => `00000000-0000-0000-0000-${String(n.toString(16)).padStart(12, '0')}`
await context.addInitScript(
  ({ fixture, origin, visits }) => {
    localStorage.setItem(
      'nexofolio.session',
      JSON.stringify({ token: fixture.token, expiresAt: '2099-01-01T00:00:00Z' }),
    )
    const scope = `${origin}/api:live:${fixture.user_id}`
    localStorage.setItem(
      `nexofolio.recent-projects.v1:${encodeURIComponent(scope)}`,
      JSON.stringify(visits),
    )
  },
  {
    fixture,
    origin,
    visits: [2, 23, 1, 25, 20, 18, 24].map((n, i) => ({ id: id(n), visitedAt: 100 - i })),
  },
)
const page = await context.newPage()
const errors = [],
  requests = [],
  checks = []
await page.route('**/api/**', async (route) => {
  if (route.request().method() === 'GET') return route.continue()
  // UI telemetry is acknowledged locally; no write leaves this isolated browser.
  if (new URL(route.request().url()).pathname === '/api/v1/telemetry')
    return route.fulfill({ status: 204 })
  errors.push(
    `blocked unexpected write: ${route.request().method()} ${new URL(route.request().url()).pathname}`,
  )
  return route.abort()
})
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {
  if (request.url().includes('/api/')) {
    requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname + new URL(request.url()).search,
    })
  }
})
async function ready() {
  await page.locator('.project-results[aria-busy="false"]').waitFor()
  await page.locator('.project-row').first().waitFor()
}
async function search(value) {
  await page.getByRole('searchbox', { name: '搜索全部项目' }).fill(value)
  await page.getByRole('searchbox', { name: '搜索全部项目' }).press('Enter')
  await page.locator('.project-results[aria-busy="false"]').waitFor()
}
async function layout(width, height, name) {
  await page.setViewportSize({ width, height })
  await page.waitForTimeout(350)
  const result = await page.evaluate(() => {
    const overlaps = []
    for (const row of document.querySelectorAll('.project-row')) {
      const cells = [...row.querySelectorAll('td')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => ({ name: el.className, rect: el.getBoundingClientRect() }))
      for (let i = 0; i < cells.length; i++)
        for (let j = i + 1; j < cells.length; j++) {
          const a = cells[i].rect,
            b = cells[j].rect
          if (
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
          )
            overlaps.push([cells[i].name, cells[j].name])
        }
    }
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      tableOverflow:
        document.querySelector('.project-results').scrollWidth >
        document.querySelector('.project-results').clientWidth + 1,
      overlaps,
    }
  })
  assert.deepEqual(
    result,
    { overflow: false, tableOverflow: false, overlaps: [] },
    `layout ${name}`,
  )
  await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true })
  checks.push({ name, ...result })
}
try {
  await page.goto(`${origin}/projects`)
  await ready()
  await page.waitForFunction(() => document.querySelector('.group-count')?.textContent === '5')
  assert.equal(
    await page.locator('.project-toolbar').evaluate((el) => getComputedStyle(el).borderBottomWidth),
    '0px',
  )
  assert.equal(await page.locator('.project-filter').count(), 0)
  assert.equal(await page.getByText('全项目搜索与权限筛选', { exact: false }).count(), 0)
  assert.deepEqual(
    (await page.locator('thead th').allTextContents()).map((s) => s.trim()),
    ['项目名称', '最近整理 （北京时间）', '整理人', '操作权限', '操作'],
  )
  let names = await page.locator('.project-name').allTextContents()
  assert.deepEqual(names.slice(0, 4), [
    'Alpha Fixture 02',
    'Alpha Fixture 23',
    'Alpha Fixture 01',
    'Alpha Fixture 25',
  ])
  assert(names[4].includes('跨组织'))
  assert(names[5].includes('跨组织'))
  assert.deepEqual(names.slice(6, 9), ['Alpha Fixture 21', 'Alpha Fixture 22', 'Alpha Fixture 25'])
  checks.push({ name: 'recent-five-and-global-activity-order', passed: true })
  const active = page.locator('.project-curation.is-running').first()
  assert.equal(await active.evaluate((el) => getComputedStyle(el).animationDuration), '3.6s')
  await layout(1440, 1000, 'desktop')
  await page.locator('.project-name-button').first().focus()
  await page.keyboard.press('Tab')
  await page
    .locator('.nf-project-tooltip')
    .filter({ hasText: '整理发起人昵称很长用于省略与键盘全文验证ABCDEFGHIJKLMN' })
    .waitFor()
  await page.screenshot({ path: `${evidence}/keyboard-tooltip.png` })
  checks.push({ name: 'keyboard-full-curator-tooltip', passed: true })
  await page.keyboard.press('Escape')
  await page.locator('.project-name-button').filter({ hasText: '跨组织' }).first().hover()
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.nf-project-tooltip').count(), 0)
  checks.push({ name: 'long-project-name-without-hover-popup', passed: true })
  await page.locator('.project-results').focus()
  await page.mouse.move(0, 0)
  await layout(1024, 850, 'tablet')
  await layout(390, 844, 'mobile')
  await page
    .locator('.project-name-button')
    .filter({ hasText: '跨组织' })
    .first()
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${evidence}/mobile-long-project.png` })
  await layout(320, 740, 'narrow')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  assert.equal(await active.evaluate((el) => getComputedStyle(el).animationName), 'none')
  checks.push({ name: 'reduced-motion', passed: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: '下一页', exact: true }).click()
  await ready()
  assert.equal((await page.locator('.project-name').allTextContents())[0], 'Alpha Fixture 02')
  checks.push({ name: 'recent-independent-of-page-two', passed: true })
  await search('  fIXTURE 23  ')
  assert.deepEqual(await page.locator('.project-name').allTextContents(), ['Alpha Fixture 23'])
  assert.equal((await page.locator('.project-curator').innerText()).trim(), 'fallback-account')
  assert((await page.locator('.project-curation').innerText()).includes('2026-10-17 09:02:03'))
  checks.push({ name: 'cross-page-case-whitespace-start-time-account-fallback', passed: true })
  await search('not present')
  await page.getByText('没有找到匹配的项目', { exact: true }).waitFor()
  assert((await page.locator('.project-pagination').innerText()).includes('共 0'))
  await page.getByRole('button', { name: '清除搜索', exact: true }).first().click()
  await ready()
  assert((await page.locator('.project-pagination').innerText()).includes('共 25'))
  for (const [n, text, actor] of [
    [1, '无', '无'],
    [3, '整理失败', 'fallback-account'],
    [4, '已停止', '未知'],
    [5, '需要处理', null],
    [21, '排队中', 'fallback-account'],
    [24, '已完成 · 开始时间未知', '未知'],
    [25, '等待重试', null],
  ]) {
    await search(`fixture ${String(n).padStart(2, '0')}`)
    assert.equal((await page.locator('.project-curation').innerText()).trim(), text)
    if (actor) assert.equal((await page.locator('.project-curator').innerText()).trim(), actor)
  }
  checks.push({ name: 'all-states-and-historical-unknown', passed: true })
  await search('readonly')
  assert((await page.locator('.project-access').innerText()).includes('只读查看'))
  checks.push({ name: 'permissions-retained', passed: true })
  assert.deepEqual(errors, [])
  assert(
    requests
      .filter((r) => r.path.includes('/v1/projects?'))
      .every((r) => !r.path.includes('access_state=')),
  )
  await writeFile(
    `${evidence}/browser-results.json`,
    JSON.stringify({ checks, requests, errors }, null, 2),
  )
  console.log(
    JSON.stringify({
      checks: checks.length,
      errors: errors.length,
      requests: requests.length,
      evidence,
    }),
  )
} finally {
  await browser.close()
}

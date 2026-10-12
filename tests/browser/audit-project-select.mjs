import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const {
  chromium,
} = require('/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const id = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const all = [
  { project_id: id(1), name: '云售后', status: 'doing', origin: 'zentao', permission_sources: [] },
  {
    project_id: id(2),
    name: '巴西售后',
    status: 'doing',
    origin: 'local',
    permission_sources: [{ project_id: id(1), name: '云售后', status: 'doing' }],
  },
]
const remote = {
  project_id: id(30),
  name: '远端项目',
  status: 'doing',
  origin: 'zentao',
  permission_sources: [],
}
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = [],
  errors = []
try {
  for (const [theme, width] of [
    ['light', 1440],
    ['dark', 1440],
    ['light', 390],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width, height: 960 },
      reducedMotion: 'reduce',
    })
    await ctx.addInitScript((theme) => {
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token: 'synthetic', expiresAt: '2099-01-01T00:00:00Z' }),
      )
      localStorage.setItem('nexofolio.theme', theme)
    }, theme)
    const queries = []
    let failure = true
    await ctx.route(`${origin}/api/**`, async (route) => {
      const url = new URL(route.request().url()),
        path = url.pathname
      const send = (data, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (path.endsWith('/auth/me'))
        return send({
          user: { id: id(90), account: 'A80646', display_name: 'Sheldon', enabled: true },
          capabilities: { manage_projects: true },
        })
      if (path.endsWith('/telemetry')) return route.fulfill({ status: 204 })
      if (path.endsWith('/project-management/projects')) {
        const q = url.searchParams.get('q') || ''
        queries.push(q)
        if (q === '加载') await new Promise((resolve) => setTimeout(resolve, 800))
        if (q === '失败' && failure)
          return send({ error: { message: 'synthetic unavailable' } }, 503)
        const items =
          q === '远端'
            ? [remote]
            : q === '加载' || q === '失败'
              ? all
              : all.filter((item) => item.name.includes(q))
        return send({ items, total: q ? items.length : 30, page: 1, limit: 20 })
      }
      if (path.endsWith('/audit/access'))
        return send({
          items: [],
          total: 0,
          matching_visits: 0,
          page: 1,
          limit: 20,
          precision: 'event',
          coverage: {
            detail_recording_started_at: '2026-10-11T08:00:00Z',
            retained_from: null,
            retained_until: null,
            stored_details: 0,
            capacity_evictions: 0,
            hourly_buckets: 0,
            hourly_evictions: 0,
          },
          health: { enabled: true, dropped_access: 0, storage_failures: 0 },
          retention: { days: 30, max_details: 100000 },
        })
      return send({}, 404)
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(origin + '/management/audit')
    await page.getByText('采集范围与完整性', { exact: true }).waitFor()
    await page.locator('.brand-transition').waitFor({ state: 'hidden' })
    const picker = page.getByRole('combobox', { name: '项目', exact: true })
    await picker.click()
    await page.getByRole('option', { name: '云售后', exact: true }).waitFor()
    const styles = await picker.evaluate((input) => {
      const outer = input.closest('.nf-search-select-trigger'),
        arrow = outer.querySelector('button')
      const pick = (e) => {
        const s = getComputedStyle(e)
        return {
          outline: s.outlineWidth,
          outlineStyle: s.outlineStyle,
          border: s.borderTopWidth,
          shadow: s.boxShadow,
          font: s.fontSize,
          weight: s.fontWeight,
        }
      }
      return { input: pick(input), outer: pick(outer), arrow: pick(arrow) }
    })
    assert.equal(styles.input.outlineStyle, 'none')
    assert.equal(styles.input.border, '0px')
    assert.equal(styles.arrow.outlineStyle, 'none')
    assert.equal(styles.outer.outlineStyle, 'none')
    assert.equal(styles.outer.shadow, 'none')
    assert.equal(await page.getByText('没有匹配的项目', { exact: false }).count(), 0)
    assert.ok(!queries.includes('全部项目'))
    await page.screenshot({
      path: new URL(`project-select-open-${theme}-${width}.png`, evidence).pathname,
    })
    if (theme === 'light' && width === 1440) {
      const anchor = await page.locator('.nf-search-select-trigger').boundingBox(),
        menu = await page.locator('.nf-search-select-content').boundingBox()
      await page.screenshot({
        path: new URL('project-select-fixed.png', evidence).pathname,
        clip: {
          x: anchor.x - 8,
          y: anchor.y - 28,
          width: anchor.width + 16,
          height: menu.y + menu.height - anchor.y + 36,
        },
      })
    }

    await picker.fill('巴西')
    await page.getByRole('option', { name: '巴西售后', exact: true }).waitFor()
    await page.getByRole('option', { name: '巴西售后', exact: true }).click()
    assert.equal(await picker.inputValue(), '巴西售后')
    await picker.click()
    await page.getByRole('option', { name: '云售后', exact: true }).waitFor()
    assert.ok(!queries.includes('巴西售后'))
    await picker.fill('没有这个项目')
    await page
      .getByRole('status')
      .getByText('没有匹配的项目，试试其他名称。', { exact: true })
      .waitFor()
    assert.equal(await page.getByRole('option', { name: '全部项目', exact: true }).count(), 0)
    if (width === 1440 && theme === 'light')
      await page.screenshot({ path: new URL('project-select-empty.png', evidence).pathname })
    await picker.fill('加载')
    await page.getByRole('status').getByText('正在查找…', { exact: true }).waitFor()
    if (width === 1440 && theme === 'light')
      await page.screenshot({ path: new URL('project-select-loading.png', evidence).pathname })
    await page.getByRole('option', { name: '云售后', exact: true }).waitFor()
    await picker.fill('失败')
    await page.getByRole('alert').getByText('项目读取失败，请重试。', { exact: true }).waitFor()
    if (width === 1440 && theme === 'light')
      await page.screenshot({ path: new URL('project-select-error.png', evidence).pathname })
    failure = false
    await page.getByRole('button', { name: '重试', exact: true }).click()
    await page.getByRole('option', { name: '云售后', exact: true }).waitFor()
    await picker.fill('远端')
    await page.getByRole('option', { name: '远端项目', exact: true }).click()
    assert.equal(await picker.inputValue(), '远端项目')
    await picker.click()
    await page.getByRole('option', { name: '云售后', exact: true }).waitFor()
    assert.equal(await picker.inputValue(), '远端项目')
    await page.keyboard.press('Escape')
    await picker.focus()
    await page.keyboard.press('ArrowDown')
    await page.getByRole('option', { name: '全部项目', exact: true }).waitFor()
    const keyboard = await picker.evaluate((input) => ({
      outer: getComputedStyle(input.closest('.nf-search-select-trigger')).outlineStyle,
      inner: getComputedStyle(input).outlineStyle,
    }))
    assert.equal(keyboard.outer, 'solid')
    assert.equal(keyboard.inner, 'none')
    if (width === 1440 && theme === 'light')
      await page.screenshot({ path: new URL('project-select-keyboard.png', evidence).pathname })
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.getByRole('option', { name: '全部项目', exact: true }).waitFor({ state: 'hidden' })
    assert.equal(await picker.inputValue(), '全部项目')
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    )
    results.push({ theme, width, styles, keyboard, queries, passed: true })
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('project-select-results.json', evidence),
    JSON.stringify({ results, errors }, null, 2),
  )
  console.log(JSON.stringify({ passed: results.length, errors }, null, 2))
} finally {
  await browser.close()
}

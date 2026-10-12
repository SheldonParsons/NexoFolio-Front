// Real browser/API acceptance against a guarded disposable lifecycle fixture.
// No response interception, model calls or successful document writes.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const meta = JSON.parse(
  await readFile(
    process.env.LIFECYCLE_LIVE_CONTROL || '/tmp/nexofolio-lifecycle-live-control.json',
    'utf8',
  ),
)
assert.equal(new URL(meta.origin).hostname, '127.0.0.1')
assert.ok(path.basename(meta.private).startsWith('nexofolio-lifecycle-live.'))
const fixture = JSON.parse(await readFile(meta.fixture, 'utf8')),
  p = fixture.projects[0],
  ids = p.status_fixture
assert.ok(ids.old_candidate && ids.fresh_candidate && ids.interrupted_candidate)
const evidence = new URL('../../docs/reviews/document-tree-actions-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const results = [],
  errors = [],
  writes = []
const headers = { Authorization: `Bearer ${fixture.user.token}` }
async function api(suffix) {
  const r = await fetch(`${meta.api}/v1/projects/${p.id}${suffix}`, { headers })
  assert.equal(r.status, 200)
  return r.json()
}
const before = await api('/document-lifecycle'),
  rawBefore = await api(`/curate/candidates/${ids.old_candidate}`)
for (const suffix of [
  '/curate/candidates',
  '/curate/candidates?panel_entry=true',
  '/curate/candidates?review_entry=true',
  `/curate/candidates?panel_entry=true&selected_id=${ids.interrupted_candidate}`,
]) {
  const rows = await api(suffix)
  const old = rows.find((row) => row.id === ids.old_candidate)
  if (old) {
    assert.equal(old.progress.lifecycle_version, 0)
    assert.equal(old.progress.lifecycle_stale, true)
    assert.equal(old.progress.resume_available, false)
  }
  const interrupted = rows.find((row) => row.id === ids.interrupted_candidate)
  if (interrupted) {
    assert.equal(interrupted.progress.lifecycle_stale, true)
    assert.equal(interrupted.progress.resume_available, false)
  }
  const fresh = rows.find((row) => row.id === ids.fresh_candidate)
  if (fresh) {
    assert.equal(fresh.progress.lifecycle_version, 1)
    assert.equal(fresh.progress.lifecycle_stale, false)
  }
}
results.push('all real summary entry points compare frozen and current versions')
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
async function ready(page) {
  await page.locator('.document-definition-title h2, .document-overview-title h2').waitFor()
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  await page.waitForTimeout(200)
}
async function closeProgress(page) {
  const button = page.getByRole('button', { name: '关闭进度面板', exact: true })
  if (await button.isVisible()) await button.click()
}
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  })
  await ctx.addInitScript(
    (token) =>
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token, expiresAt: '2099-01-01T00:00:00Z' }),
      ),
    fixture.user.token,
  )
  const page = await ctx.newPage()
  page.setDefaultTimeout(25000)
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('request', (r) => {
    if (
      r.url().startsWith(meta.origin + '/api/') &&
      !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) &&
      !r.url().includes('/telemetry')
    )
      writes.push({ method: r.method(), path: new URL(r.url()).pathname })
  })
  const url = `${meta.origin}/projects/${p.id}/interfaces/endpoints/${p.create}?env=${p.environment}`
  await page.goto(url)
  await ready(page)
  await page.getByText('本轮基于旧废弃状态', { exact: true }).waitFor()
  await page.locator('.curation-dock .lifecycle-project-notice').waitFor()
  await page.screenshot({
    path: new URL('stale-panel-live.png', evidence).pathname,
    fullPage: true,
  })
  results.push('default old-candidate floating panel clearly reports stale lifecycle')
  await page.getByRole('button', { name: '切换面板中的整理内容', exact: true }).click()
  await page.locator('.curation-panel-run-item').filter({ hasText: '已应用' }).click()
  await page.getByText('本轮已应用', { exact: true }).waitFor()
  assert.equal(await page.locator('.curation-dock .lifecycle-project-notice').count(), 0)
  await page.getByRole('button', { name: '切换面板中的整理内容', exact: true }).click()
  await page.locator('.curation-panel-run-item').filter({ hasText: /中断/ }).click()
  await page.getByText('本轮基于旧废弃状态', { exact: true }).waitFor()
  assert.equal(
    await page
      .locator('.curation-dock-actions button')
      .filter({ hasText: /补齐|续跑/ })
      .count(),
    0,
  )
  results.push('manual fresh/old selection updates notices and hides stale resume')
  await closeProgress(page)
  const folder = page
      .locator('.document-folder-heading')
      .filter({ has: page.locator(`[data-folder-id="${p.folders[2]}"]`) }),
    trigger = folder.locator('.lifecycle-tree-trigger'),
    selected = page.locator('.lifecycle-endpoint-row.is-selected .lifecycle-tree-trigger')
  await page.mouse.move(1400, 20)
  await page.waitForTimeout(180)
  const geometry = await folder.boundingBox()
  const folderLink = folder.locator('.document-folder-toggle'),
    endpointRow = page.locator('.lifecycle-endpoint-row.is-tree-row').first(),
    endpointLink = endpointRow.locator('.interface-list-item')
  for (const [row, link] of [
    [folder, folderLink],
    [endpointRow, endpointLink],
  ]) {
    const rowBounds = await row.boundingBox(),
      linkBounds = await link.boundingBox()
    assert.ok(Math.abs(rowBounds.x + rowBounds.width - linkBounds.x - linkBounds.width) < 1)
  }
  assert.equal(await trigger.evaluate((el) => getComputedStyle(el).position), 'absolute')
  const style = await trigger.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      opacity: s.opacity,
      border: s.borderTopWidth,
      background: s.backgroundColor,
      shadow: s.boxShadow,
    }
  })
  assert.equal(style.opacity, '0')
  assert.equal(style.border, '0px')
  assert.equal(style.shadow, 'none')
  assert.equal(await selected.evaluate((el) => getComputedStyle(el).opacity), '1')
  assert.equal(
    await folderLink.locator('small').evaluate((el) => getComputedStyle(el).opacity),
    '1',
  )
  const linkGeometry = await folderLink.boundingBox()
  await folder.hover()
  await page.waitForTimeout(180)
  assert.equal(await trigger.evaluate((el) => getComputedStyle(el).opacity), '1')
  assert.deepEqual(await folder.boundingBox(), geometry)
  assert.deepEqual(await folderLink.boundingBox(), linkGeometry)
  assert.equal(
    await folderLink.locator('small').evaluate((el) => getComputedStyle(el).opacity),
    '0',
  )
  const beforeUrl = page.url()
  await trigger.click()
  await page.getByRole('menuitem', { name: '废弃', exact: true }).waitFor()
  await page.mouse.move(1400, 20)
  assert.equal(await trigger.evaluate((el) => getComputedStyle(el).opacity), '1')
  assert.equal(page.url(), beforeUrl)
  await page.waitForTimeout(200)
  await page
    .locator('.interface-list-scroll')
    .screenshot({ path: new URL('tree-menu-light.png', evidence).pathname })
  await page.keyboard.press('Escape')
  await page.getByRole('menu').waitFor({ state: 'hidden' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: '废弃', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  results.push(
    'tree links use the full row width; floating actions replace counts/arrows without a gutter or layout shift',
  )
  await page.keyboard.press('Tab')
  await page.mouse.move(1400, 20)
  const checkbox = page.getByRole('checkbox', { name: '显示已废弃', exact: true })
  assert.equal(await checkbox.evaluate((el) => el.tagName), 'BUTTON')
  assert.equal((await checkbox.boundingBox()).width, 14)
  assert.equal(await page.locator('.lifecycle-tree-toggle input[type="checkbox"]').count(), 0)
  await checkbox.check()
  assert.equal(await checkbox.getAttribute('data-state'), 'checked')
  await page.waitForTimeout(200)
  assert.equal(
    await checkbox
      .locator('path')
      .evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset)),
    0,
  )
  await page.locator('.lifecycle-tree-toggle').screenshot({
    path: new URL('checkbox-checked.png', evidence).pathname,
  })
  await checkbox.focus()
  await page.keyboard.press('Space')
  await checkbox.waitFor({ state: 'visible' })
  assert.equal(await checkbox.getAttribute('data-state'), 'unchecked')
  await page.locator('.lifecycle-tree-toggle label').click()
  assert.equal(await checkbox.getAttribute('data-state'), 'checked')
  await checkbox.uncheck()
  results.push('Reka checkbox supports label clicks, Space, filtering and a drawn checkmark')
  await page.mouse.move(1400, 20)
  await page.waitForTimeout(200)
  await page.locator('.interface-sidebar').screenshot({
    path: new URL('tree-no-gutter.png', evidence).pathname,
  })
  await page.getByRole('button', { name: '切换深色模式', exact: true }).click()
  await folder.hover()
  await page.waitForTimeout(200)
  await page
    .locator('.interface-list-scroll')
    .screenshot({ path: new URL('tree-dark.png', evidence).pathname })
  assert.equal(await trigger.evaluate((el) => getComputedStyle(el).borderTopWidth), '0px')
  results.push('dark theme keeps unframed tree controls')
  const touch = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  await touch.addInitScript(
    (token) =>
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token, expiresAt: '2099-01-01T00:00:00Z' }),
      ),
    fixture.user.token,
  )
  const mobile = await touch.newPage()
  mobile.on('pageerror', (e) => errors.push(e.message))
  await mobile.goto(
    `${meta.origin}/projects/${p.id}/interfaces/folders/${p.folders[2]}?env=${p.environment}`,
  )
  await ready(mobile)
  await closeProgress(mobile)
  const back = mobile.getByRole('link', { name: '返回目录列表', exact: true })
  if (await back.isVisible()) await back.click()
  await mobile.locator('.document-folder-heading .lifecycle-tree-trigger').first().waitFor()
  await mobile.locator('.brand-transition').waitFor({ state: 'hidden' })
  await closeProgress(mobile)
  const mobileTrigger = mobile.locator('.document-folder-heading .lifecycle-tree-trigger').first()
  assert.equal(await mobileTrigger.evaluate((el) => getComputedStyle(el).opacity), '1')
  assert.ok((await mobileTrigger.boundingBox()).height >= 36)
  assert.equal(await mobileTrigger.evaluate((el) => getComputedStyle(el).position), 'static')
  const mobileCheckbox = mobile.getByRole('checkbox', { name: '显示已废弃', exact: true })
  await mobileCheckbox.check()
  assert.equal(
    await mobileCheckbox.locator('path').evaluate((el) => getComputedStyle(el).transitionDuration),
    '0s',
  )
  await mobileCheckbox.uncheck()
  await mobileTrigger.click()
  await mobile.getByRole('menuitem', { name: '废弃', exact: true }).waitFor()
  await mobile.screenshot({
    path: new URL('tree-touch-menu.png', evidence).pathname,
    fullPage: true,
  })
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  results.push('touch controls remain visible, reachable and free of horizontal overflow')
  assert.deepEqual(errors, [])
  assert.deepEqual(writes, [])
  const after = await api('/document-lifecycle'),
    rawAfter = await api(`/curate/candidates/${ids.old_candidate}`)
  assert.deepEqual(after, before)
  assert.deepEqual(rawAfter.progress, rawBefore.progress)
  results.push('reading menus and summaries does not rewrite lifecycle or saved checkpoints')
  // A successful own action must update the selected applied snapshot now,
  // rather than waiting for the existing 30-second idle polling interval.
  await page.goto(url)
  await ready(page)
  await page.getByRole('button', { name: '切换面板中的整理内容', exact: true }).click()
  await page.locator('.curation-panel-run-item').filter({ hasText: '已应用' }).click()
  await page.getByText('本轮已应用', { exact: true }).waitFor()
  await page.locator('.document-description-action .lifecycle-trigger').click()
  await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
  await page
    .getByRole('textbox', { name: '废弃原因' })
    .fill('临时验收：验证自己的操作立即更新旧版本提示')
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/document-lifecycle') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: '确认废弃', exact: true }).click(),
  ])
  assert.equal(response.status(), 200)
  await page.getByText('本轮基于旧废弃状态', { exact: true }).waitFor({ timeout: 5000 })
  assert.equal((await api('/document-lifecycle')).version, before.version + 1)
  assert.deepEqual(
    (await api(`/curate/candidates/${ids.old_candidate}`)).progress,
    rawBefore.progress,
  )
  assert.equal(writes.length, 1)
  assert.ok(writes[0].path.endsWith('/document-lifecycle'))
  results.push(
    'own lifecycle change immediately refreshes panel status without another polling loop',
  )
  console.log('PASS', JSON.stringify(results))
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify(
      {
        status: 'passed',
        real_api: true,
        mocked_responses: false,
        model_calls: 0,
        checks: results,
        page_errors: errors,
        document_writes: writes,
      },
      null,
      2,
    ) + '\n',
  )
} catch (error) {
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify(
      {
        status: 'failed',
        checks: results,
        error: String(error.stack ?? error),
        page_errors: errors,
      },
      null,
      2,
    ) + '\n',
  )
  throw error
} finally {
  await browser.close()
}

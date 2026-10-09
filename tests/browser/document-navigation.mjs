// Isolated browser acceptance: no request reaches the backend. All API responses are synthetic.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/document-navigation-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const testEnv = '10000000-0000-4000-8000-000000000001',
  emptyEnv = '10000000-0000-4000-8000-000000000002'
const index = JSON.parse(
  (await readFile(new URL('../fixtures/document-navigation.json', import.meta.url), 'utf8'))
    .replaceAll('test-env', testEnv)
    .replaceAll('empty-env', emptyEnv),
)
const pid = 'fixture-navigation',
  base = `${origin}/projects/${pid}/interfaces`,
  results = [],
  reads = [],
  errors = []
const project = {
  project_id: pid,
  name: '隔离模拟 · 文档导航',
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
}
const user = {
  id: 'fixture-user',
  account: 'fixture-user',
  display_name: '隔离模拟用户',
  enabled: true,
}
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
let denied = false,
  late = false
const fixtureRoute = async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname.replace('/api', '')
  reads.push({ method: req.method(), path, query: url.search })
  const send = (data, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
  if (path === '/v1/auth/login' && req.method() === 'POST')
    return send({
      user,
      token: 'synthetic-browser-session',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00Z',
      project_sync: { status: 'done' },
    })
  if (req.method() !== 'GET')
    return send({ error: { message: 'Fixture prohibits business writes' } }, 405)
  if (path === '/v1/auth/me') return send({ user })
  if (path === `/v1/projects/${pid}`)
    return send({ ...project, ...(denied ? { can_access: false, access_state: 'denied' } : {}) })
  if (path === `/v1/projects/${pid}/environments`)
    return send({
      items: [
        { id: testEnv, name: '测试环境' },
        { id: emptyEnv, name: '稀疏观测环境' },
      ],
      page: 1,
      limit: 100,
      total: 2,
    })
  if (path === `/v1/projects/${pid}/catalog`) return send(index.catalog)
  if (path === `/v1/projects/${pid}/endpoints`)
    return send({ endpoints: index.entries.map((e) => e.summary) })
  if (path === `/v1/projects/${pid}/curate`)
    return send({
      status: 'idle',
      stage: null,
      completed: 0,
      total: 0,
      generated: 0,
      unchanged: 0,
      message: null,
    })
  if (path === `/v1/projects/${pid}/catalog/interfaces`) {
    const entries = index.entries.filter((e) => e.folderId === url.searchParams.get('directory_id'))
    return send({ items: entries, total: entries.length, page: 1, limit: 100 })
  }
  if (path.startsWith(`/v1/projects/${pid}/endpoints/`)) {
    const id = path.split('/').at(-1),
      entry = index.entries.find((e) => e.interface_id === (id === 'alias' ? 'endpoint-0' : id))
    if (id === 'forbidden')
      return send({ error: { code: 'FORBIDDEN', message: '无访问权限' } }, 403)
    if (!entry) return send({ error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404)
    if (late && id === 'endpoint-0') await new Promise((r) => setTimeout(r, 900))
    return send({
      facts: {
        summary: entry.summary,
        aliases: id === 'alias' ? ['alias'] : [],
        addresses: [],
        fields: [],
        examples: [],
      },
      knowledge: {
        note: {
          endpoint: entry.interface_id,
          name: entry.name,
          purpose: entry.purpose,
          author: { by: 'person', user: 'fixture-user' },
          at: '2026-10-07T00:00:00Z',
        },
        placement: {
          endpoint: entry.interface_id,
          folder: entry.folderId,
          at: '2026-10-07T00:00:00Z',
        },
        fields: [],
        links: [],
      },
    })
  }
  return send({ error: { code: 'FIXTURE_UNKNOWN', message: '未配置的隔离请求' } }, 404)
}
await context.route(`${origin}/api/**`, fixtureRoute)
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(e.message))
async function check(name, fn) {
  await fn()
  results.push({ name, passed: true })
  console.log('PASS', name)
}
async function snap(name) {
  await page.screenshot({ path: new URL(name + '.png', evidence).pathname, fullPage: true })
}
async function idle() {
  await page.locator('.interface-list-scroll [data-folder-id="root"]').waitFor()
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  await page.locator('.app-viewport[inert]').waitFor({ state: 'hidden' })
}
try {
  await check('auth guard and login return preserve folder/env', async () => {
    await page.goto(`${base}/folders/child?env=${testEnv}`)
    await page.getByRole('dialog').waitFor()
    await snap('login-guard')
    await page.getByLabel('账号', { exact: true }).fill('fixture-user')
    await page.getByLabel('密码', { exact: true }).fill('synthetic-password')
    await page.getByLabel('记住账号和密码').uncheck()
    await page.getByRole('button', { name: '登录并进入' }).click()
    await idle()
    assert.equal(page.url(), `${base}/folders/child?env=${testEnv}`)
    await page.locator('.document-overview-title h2').waitFor()
    assert.match(await page.locator('.document-overview-title').innerText(), /技术咨询/)
    await snap('folder-overview')
  })
  await check(
    'folder arrow only folds; name opens overview; ancestors and refresh restore',
    async () => {
      const arrow = page.getByRole('button', { name: '折叠订单协作' })
      await arrow.click()
      assert.equal(page.url(), `${base}/folders/child?env=${testEnv}`)
      await page.getByRole('button', { name: '展开订单协作' }).click()
      await page.locator('.interface-list-scroll [data-folder-id="root"]').click()
      await page.locator('.document-overview-title h2').filter({ hasText: '订单协作' }).waitFor()
      await page.locator('.document-overview-card').filter({ hasText: '技术咨询' }).click()
      await page.waitForURL(`${base}/folders/child?env=${testEnv}`)
      await page.reload()
      await idle()
      await page.locator('.document-overview-title h2').filter({ hasText: '技术咨询' }).waitFor()
    },
  )
  await check(
    'hover immediate; preserves URL/selection; portal/card entry/clipboard/animation',
    async () => {
      const link = page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]')
      const before = page.url(),
        count = reads.length
      await link.hover()
      assert.equal(await page.locator('.document-preview[data-state="open"]').count(), 1)
      await page.locator('.document-preview[data-state="open"]').waitFor()
      const card = page.locator('.document-preview[data-state="open"]')
      assert.match(await card.innerText(), /查询技术咨询/)
      assert.equal(await card.getByRole('link').count(), 0)
      assert.equal(await card.getByRole('button', { name: '复制链接' }).count(), 0)
      assert.equal(await card.locator('.document-preview-hint').count(), 0)
      assert.equal(page.url(), before)
      assert.equal(reads.length, count)
      const facts = await card.evaluate((el) => ({
        parentOutsideSidebar: !el.closest('.interface-sidebar'),
        duration: getComputedStyle(el).animationDuration,
        width: el.getBoundingClientRect().width,
        focus: document.activeElement?.tagName,
      }))
      assert.equal(facts.parentOutsideSidebar, true)
      assert.equal(facts.duration, '0s')
      results.push({ preview: facts })
      await card.hover()
      await page.waitForTimeout(500)
      assert.equal(await card.count(), 1)
      await snap('endpoint-hover-light')
      await card.getByRole('button', { name: '复制路径' }).click()
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), index.entries[0].path)
      await page.mouse.move(1200, 800)
      await page.waitForTimeout(200)
      const closing = page.locator('.document-preview[data-state="closed"]')
      if (await closing.count())
        assert.equal(await closing.evaluate((el) => getComputedStyle(el).animationDuration), '0s')
      await page.locator('.document-preview').waitFor({ state: 'hidden' })
    },
  )
  await check(
    'rapid scanning cancels previous preview; keyboard actions and Escape restore trigger',
    async () => {
      const a = page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]'),
        b = page.locator('.interface-list-scroll [data-endpoint-id="endpoint-1"]')
      await a.hover()
      await page.waitForTimeout(90)
      await b.hover()
      await page.waitForTimeout(90)
      await page.mouse.move(1200, 800)
      await page.waitForTimeout(450)
      assert.equal(await page.locator('.document-preview').count(), 0)
      await a.focus()
      await page.locator('.document-preview[data-state="open"]').waitFor()
      assert.equal(await a.evaluate((el) => el === document.activeElement), true)
      await a.press('ArrowRight')
      assert.match(await page.locator('.document-preview-hint').innerText(), /选中“复制路径”/)
      assert.equal(
        await page
          .locator('.document-preview .document-preview-copy-path')
          .evaluate((el) => el === document.activeElement),
        true,
      )
      await page.keyboard.press('Enter')
      await page
        .locator('.document-preview [role="status"]')
        .filter({ hasText: '已复制接口路径' })
        .waitFor()
      assert.match(await page.locator('.document-preview').innerText(), /已复制接口路径/)
      await snap('keyboard-preview')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(600)
      assert.equal(await page.locator('.document-preview').count(), 0)
      assert.equal(await a.evaluate((el) => el === document.activeElement), true)
    },
  )
  await check(
    'overview lateral preview keeps downward mouse channel free at normal/narrow widths and right edge',
    async () => {
      const before = page.url()
      for (const viewport of [
        { width: 1280, height: 900 },
        { width: 820, height: 700 },
      ]) {
        await page.setViewportSize(viewport)
        const first = page.locator('.document-overview [data-endpoint-id="endpoint-0"]')
        const next = page.locator('.document-overview [data-endpoint-id="endpoint-1"]')
        await first.hover({ position: { x: 80, y: 16 } })
        const card = page.locator('.document-preview[data-state="open"]')
        await card.waitFor()
        await card.locator('strong').filter({ hasText: '查询技术咨询' }).waitFor()
        const row = await first.boundingBox(),
          second = await next.boundingBox(),
          x = row.x + 80
        const box = await card.boundingBox()
        assert.ok(
          box.x >= 12 &&
            box.y >= 12 &&
            box.x + box.width <= viewport.width - 12 &&
            box.y + box.height <= viewport.height - 12,
        )
        assert.ok(box.x > x || box.x + box.width < x, 'panel must leave the mouse column free')
        assert.equal(await card.evaluate((el) => getComputedStyle(el).animationName), 'none')
        await snap(
          viewport.width === 1280 ? 'overview-hover-contained' : 'overview-hover-narrow-channel',
        )
        await page.mouse.move(x, second.y + second.height / 2, { steps: 10 })
        assert.equal(
          await page.evaluate(
            ({ x, y }) =>
              document
                .elementFromPoint(x, y)
                ?.closest('[data-endpoint-id]')
                ?.getAttribute('data-endpoint-id'),
            { x, y: second.y + second.height / 2 },
          ),
          'endpoint-1',
        )
        await card.locator('strong').filter({ hasText: '完成流程任务' }).waitFor()
        assert.equal(page.url(), before)
        results.push({ downwardChannel: { viewport, x, panel: box, nextEndpoint: 'endpoint-1' } })
        await first.hover({ position: { x: row.width - 20, y: 16 } })
        await card.locator('strong').filter({ hasText: '查询技术咨询' }).waitFor()
        const edgeBox = await card.boundingBox(),
          edgeX = row.x + row.width - 20
        assert.ok(edgeBox.x >= 12 && edgeBox.x + edgeBox.width <= viewport.width - 12)
        assert.ok(edgeBox.x > edgeX || edgeBox.x + edgeBox.width < edgeX)
        if (viewport.width === 1280) {
          await snap('overview-hover-right-edge')
          await card.hover()
          await page.waitForTimeout(240)
          assert.equal(await card.count(), 1)
          await card.getByRole('button', { name: '复制路径', exact: true }).click()
          await card.getByRole('status').filter({ hasText: '已复制接口路径' }).waitFor()
        }
        await page.keyboard.press('Escape')
      }
      await page.setViewportSize({ width: 1280, height: 900 })
      const line = await page.locator('.document-folder-heading.is-selected').evaluate((el) => ({
        radius: getComputedStyle(el, '::before').borderRadius,
        width: getComputedStyle(el, '::before').width,
        shadow: getComputedStyle(el).boxShadow,
      }))
      assert.deepEqual(line, { radius: '0px', width: '2px', shadow: 'none' })
      results.push({ selectionMarker: line })
    },
  )
  await check(
    'endpoint routes history/tab/env; same project index and sidebar scroll retained',
    async () => {
      const readsBefore = reads.filter((r) => r.path.endsWith('/catalog')).length
      await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').click()
      await page.locator('.document-definition-title h2').waitFor()
      const marker = await page.locator('.interface-list-item.is-selected').evaluate((el) => ({
        radius: getComputedStyle(el, '::before').borderRadius,
        width: getComputedStyle(el, '::before').width,
        shadow: getComputedStyle(el).boxShadow,
      }))
      assert.deepEqual(marker, { radius: '0px', width: '2px', shadow: 'none' })
      await page.mouse.move(1200, 800)
      await page.waitForTimeout(200)
      await snap('endpoint-selected-straight')
      await page.getByRole('tab', { name: /真实样本/ }).click()
      await page.waitForURL(/tab=examples/)
      assert.match(page.url(), /tab=examples/)
      await page.reload()
      await idle()
      assert.equal(
        await page.getByRole('tab', { name: /真实样本/ }).getAttribute('data-state'),
        'active',
      )
      await page.getByRole('button', { name: '稀疏观测环境', exact: true }).click()
      await page.getByRole('status').filter({ hasText: '此接口在当前环境尚无观测' }).waitFor()
      await snap('no-observation')
      await page.goBack()
      await page.locator('.document-scope-notice').waitFor({ state: 'hidden' })
      await page.goForward()
      await page.locator('.document-scope-notice').waitFor()
      await page.getByRole('button', { name: '测试环境', exact: true }).click()
      await page.locator('.document-scope-notice').waitFor({ state: 'hidden' })
      const bottom = page.locator('.interface-list-scroll [data-endpoint-id="endpoint-26"]')
      await bottom.scrollIntoViewIfNeeded()
      await bottom.click()
      await page.waitForTimeout(300)
      const scroll = await page.locator('.interface-list-scroll').evaluate((el) => el.scrollTop),
        catalogCount = reads.filter((r) => r.path.endsWith('/catalog')).length
      await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-25"]').click()
      await page.waitForTimeout(300)
      assert.equal(
        await page.locator('.interface-list-scroll').evaluate((el) => el.scrollTop),
        scroll,
      )
      assert.equal(reads.filter((r) => r.path.endsWith('/catalog')).length, catalogCount)
      assert.equal(await page.locator('.brand-transition').count(), 0)
      results.push({
        catalogReadsBefore: readsBefore,
        catalogReadsAfter: catalogCount,
        sidebarScroll: scroll,
      })
    },
  )
  await check('search retains selected target and deep link new tab', async () => {
    await page.getByRole('searchbox').fill('no-match')
    assert.equal(
      await page
        .locator('.interface-list-scroll a[aria-current="page"]')
        .getAttribute('data-endpoint-id'),
      'endpoint-25',
    )
    const href = await page
      .locator('.interface-list-scroll a[aria-current="page"]')
      .getAttribute('href')
    const opened = context.waitForEvent('page')
    await page
      .locator('.interface-list-scroll a[aria-current="page"]')
      .click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] })
    const second = await opened
    await second.locator('.document-definition-title h2').waitFor()
    assert.equal(second.url(), origin + href)
    assert.match(await second.locator('.document-definition-title h2').innerText(), /25/)
    await second.close()
    await page.getByRole('searchbox').fill('')
  })
  await check('dark preview and viewport edges avoid clipping; scroll closes', async () => {
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
    })
    await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-27"]').hover()
    await page.locator('.document-preview[data-state="open"]').waitFor()
    const box = await page.locator('.document-preview[data-state="open"]').boundingBox()
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 900)
    await snap('endpoint-hover-dark-edge')
    await page.locator('.interface-list-scroll').evaluate((el) => (el.scrollTop -= 100))
    await page.locator('.document-preview').waitFor({ state: 'hidden' })
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light'
    })
  })
  await check('reduced motion preview and narrow layout', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 820, height: 700 })
    await page
      .locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]')
      .scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await page.mouse.move(800, 650)
    await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').hover()
    await page.locator('.document-preview[data-state="open"]').waitFor()
    assert.equal(
      await page.locator('.document-preview').evaluate((el) => getComputedStyle(el).animationName),
      'none',
    )
    const box = await page.locator('.document-preview').boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= 820 && box.y + box.height <= 700)
    await snap('narrow-reduced-motion')
    await page.keyboard.press('Escape')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })
  await check(
    'invalid environment/folder/endpoint and forbidden resource; established alias',
    async () => {
      for (const [route, text] of [
        [`folders/missing?env=${testEnv}`, '此目录已失效'],
        [`endpoints/missing?env=${testEnv}`, '此接口已失效'],
        [`endpoints/forbidden?env=${testEnv}`, '暂无此接口的访问权限'],
        ['folders/root?env=missing', '链接中的环境已失效'],
      ]) {
        await page.goto(base + '/' + route)
        await idle()
        await page.getByRole('alert').filter({ hasText: text }).waitFor()
      }
      await snap('invalid-environment')
      await page.goto(`${base}/endpoints/alias?env=${testEnv}&tab=examples`)
      await idle()
      await page.waitForURL(`${base}/endpoints/endpoint-0?env=${testEnv}&tab=examples`)
      denied = true
      await page.reload()
      await page.getByRole('alert').filter({ hasText: '暂无此项目的访问权限' }).first().waitFor()
      await snap('permission-denied')
      denied = false
    },
  )
  await check('late detail never overwrites folder content', async () => {
    await page.goto(`${base}/folders/child?env=${testEnv}`)
    await idle()
    late = true
    await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').click()
    await page.locator('.interface-list-scroll [data-folder-id="root"]').click()
    await page.locator('.document-overview-title h2').filter({ hasText: '订单协作' }).waitFor()
    await page.waitForTimeout(1100)
    assert.equal(await page.locator('.document-definition-title').count(), 0)
    late = false
  })
  await check('touch tap enters detail without hover on actual mobile context', async () => {
    const touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      storageState: await context.storageState(),
    })
    await touch.route(`${origin}/api/**`, fixtureRoute)
    const mobile = await touch.newPage()
    mobile.on('pageerror', (e) => errors.push(e.message))
    await mobile.goto(`${base}?env=${testEnv}`)
    await mobile.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').waitFor()
    await mobile.locator('.brand-transition').waitFor({ state: 'hidden' })
    await mobile.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').tap()
    await mobile.locator('.document-definition-title h2').waitFor()
    await mobile.waitForTimeout(450)
    assert.equal(await mobile.locator('.document-preview').count(), 0)
    assert.equal(await mobile.locator('.interface-sidebar').isVisible(), false)
    await mobile.screenshot({
      path: new URL('mobile-detail.png', evidence).pathname,
      fullPage: true,
    })
    await touch.close()
  })
  assert.deepEqual(errors, [])
  assert.equal(reads.filter((r) => r.method !== 'GET' && r.path !== '/v1/auth/login').length, 0)
  await writeFile(
    new URL('browser-results.json', evidence),
    JSON.stringify(
      {
        mode: 'isolated synthetic API responses; normal app auth/router retained',
        results,
        requests: reads,
        errors,
      },
      null,
      2,
    ) + '\n',
  )
  console.log('Complete:', results.filter((r) => r.passed).length, 'browser cases')
} catch (error) {
  await snap('failure')
  await writeFile(
    new URL('failure.json', evidence),
    JSON.stringify({ error: String(error), results, errors, requests: reads }, null, 2),
  )
  throw error
} finally {
  await browser.close()
}

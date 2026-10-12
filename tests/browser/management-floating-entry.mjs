// Same data and viewport for admin/member. All API reads/writes stay inside synthetic fixtures.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url),
  {
    chromium,
  } = require('/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173',
  evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const env = '10000000-0000-4000-8000-000000000001',
  candidateId = '10000000-0000-4000-8000-000000000002'
const index = JSON.parse(
  (
    await readFile(new URL('../fixtures/document-navigation.json', import.meta.url), 'utf8')
  ).replaceAll('test-env', env),
)
const pid = 'fixture-navigation',
  project = {
    project_id: pid,
    name: '同一份合成业务项目',
    status: 'doing',
    origin: 'zentao',
    can_access: true,
    access_state: 'allowed',
    reason_code: null,
  }
const field = {
  location: { in: 'request_body' },
  path: [],
  types: ['object'],
  labels: [{ environment_id: env, label: { label: 'always' } }],
  differs_between_environments: false,
  declared: null,
  conflict: null,
}
const progress = {
  status: 'done',
  candidate_id: candidateId,
  candidate_state: 'applied',
  run_id: candidateId,
  stage: null,
  completed: 2,
  total: 2,
  generated: 2,
  unchanged: 0,
  fields_completed: 2,
  fields_total: 2,
  fields_failed: 0,
  fields_pending: 0,
  activity: [],
  active: [],
  issues: [],
  started_at: '2026-10-11T08:00:00Z',
  updated_at: '2026-10-11T08:02:00Z',
}
const candidate = {
  id: candidateId,
  project_id: pid,
  target: null,
  state: 'applied',
  created_at: progress.started_at,
  updated_at: progress.updated_at,
  commands: 0,
  progress,
}
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const errors = [],
  writes = [],
  results = []
async function fixture(admin, viewport, theme) {
  const ctx = await browser.newContext({
    viewport,
    reducedMotion: 'reduce',
    hasTouch: viewport.width < 600,
  })
  await ctx.addInitScript(
    ({ admin, theme }) => {
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token: admin ? 'admin' : 'member', expiresAt: '2099-01-01T00:00:00Z' }),
      )
      localStorage.setItem('nexofolio.theme', theme)
      localStorage.setItem('nexofolio.curation-panel.size.v1', 'mini')
    },
    { admin, theme },
  )
  let panel = false
  const user = {
    id: admin ? 'admin' : 'member',
    account: admin ? 'A80646' : 'member',
    display_name: '同一测试用户',
    enabled: true,
  }
  await ctx.route(`${origin}/api/**`, (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, '')
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/v1/telemetry') return route.fulfill({ status: 204 })
    if (req.method() !== 'GET') {
      writes.push({ path, method: req.method() })
      return send({}, 405)
    }
    if (path === '/v1/auth/me')
      return send({ user, capabilities: admin ? { manage_projects: true } : {} })
    if (path === '/v1/auth/profile')
      return send({
        user,
        account_display_name: user.display_name,
        display_name_override: null,
        bio: '',
        version: 1,
        created_at: progress.started_at,
        last_login_at: progress.started_at,
      })
    if (path === '/v1/projects') return send({ items: [project], total: 1, page: 1, limit: 10 })
    if (path === `/v1/projects/${pid}`) return send(project)
    if (path.endsWith('/document-lifecycle'))
      return send({ version: 0, reconciled_version: 0, decisions: [] })
    if (path.endsWith('/environments'))
      return send({ items: [{ id: env, name: '测试环境' }], total: 1, page: 1, limit: 100 })
    if (path.endsWith('/catalog')) return send(index.catalog)
    if (path.endsWith('/endpoints')) return send({ endpoints: index.entries.map((e) => e.summary) })
    if (path.endsWith('/catalog/interfaces')) {
      const items = index.entries.filter((e) => e.folderId === url.searchParams.get('directory_id'))
      return send({ items, total: items.length, page: 1, limit: 100 })
    }
    if (path.endsWith('/curate/candidates')) return send(panel ? [candidate] : [])
    if (path.includes('/curate/candidates/'))
      return send({
        ...candidate,
        parent: null,
        base_hash: 'fixture',
        base: { endpoints: [], folders: [], placements: [], notes: [], fields: [], links: [] },
        view: { endpoints: [], folders: [], placements: [], notes: [], fields: [], links: [] },
        batches: [],
        applied_rounds: [],
        reviewed_by: null,
        operations: [],
      })
    if (path.endsWith('/curate'))
      return send(
        panel
          ? progress
          : {
              status: 'idle',
              stage: null,
              completed: 0,
              total: 0,
              generated: 0,
              unchanged: 0,
              message: null,
            },
      )
    if (path.includes('/endpoints/')) {
      const endpoint = path.split('/').at(-1),
        entry = index.entries.find((e) => e.interface_id === endpoint)
      if (!entry) return send({}, 404)
      return send({
        facts: {
          summary: entry.summary,
          fields: [field, { ...field, path: [{ key: 'customerId' }], types: ['string'] }],
          aliases: [],
          addresses: [],
          examples: [],
          requests: [],
        },
        knowledge: {
          note: {
            endpoint,
            name: entry.name,
            purpose: '同一份合成接口资料',
            context: {},
            author: { by: 'person', user: 'fixture' },
            at: progress.started_at,
          },
          fields: [],
          links: [],
          path: [],
        },
      })
    }
    return send({}, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  return {
    ctx,
    page,
    setPanel: () => {
      panel = true
    },
  }
}
async function settle(page) {
  await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
      new Promise((resolve) => setTimeout(resolve, 700)),
    ])
  })
}
async function geometry(page) {
  return page.evaluate(() => {
    const round = (v) => Math.round(v * 10) / 10,
      selectors = [
        '.app-viewport',
        '.homepage',
        '.home-header',
        '.projects-layout',
        '.workspace-header',
        '#main-content',
        '.project-browser',
        '.project-list-viewport',
        '.document-workspace',
        '.documents-board',
        '.interface-list-scroll',
        '.document-detail',
        '.document-scroll',
        '.curation-dock',
        '[role="dialog"], [role="alertdialog"]',
      ]
    return Object.fromEntries(
      selectors.map((selector) => {
        const el = document.querySelector(selector)
        if (!el) return [selector, null]
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el)
        return [
          selector,
          {
            x: round(r.x),
            y: round(r.y),
            width: round(r.width),
            height: round(r.height),
            clientHeight: el.clientHeight,
            scrollHeight: el.scrollHeight,
            paddingBottom: s.paddingBottom,
            minHeight: s.minHeight,
          },
        ]
      }),
    )
  })
}
try {
  for (const [theme, viewport] of [
    ['light', { width: 1440, height: 900 }],
    ['light', { width: 390, height: 844 }],
    ['dark', { width: 1440, height: 900 }],
  ]) {
    const a = await fixture(true, viewport, theme),
      m = await fixture(false, viewport, theme)
    for (const [name, path] of [
      ['home', '/'],
      ['projects', '/projects'],
      ['document', `/projects/${pid}/interfaces/endpoints/endpoint-0?env=${env}`],
    ]) {
      for (const f of [a, m]) {
        await f.page.goto(origin + path)
        if (name === 'projects')
          await f.page.getByRole('button', { name: project.name, exact: true }).waitFor()
        if (name === 'document')
          await f.page.getByText('同一份合成接口资料', { exact: true }).waitFor()
        await settle(f.page)
      }
      await a.page.locator('.management-entry').waitFor()
      assert.equal(await m.page.locator('.management-entry').count(), 0)
      const ag = await geometry(a.page),
        mg = await geometry(m.page)
      assert.deepEqual(
        ag,
        mg,
        `${theme}/${viewport.width}/${name}: identity must not change layout`,
      )
      const entry = await a.page.locator('.management-entry').boundingBox()
      assert.ok(
        entry.width < 110 &&
          entry.height <= 48 &&
          entry.x >= 0 &&
          entry.y + entry.height <= viewport.height,
      )
      assert.equal(
        await a.page.evaluate(() => {
          const e = document.querySelector('.management-entry')
          return getComputedStyle(e).position
        }),
        'fixed',
      )
      assert.equal(ag['.app-viewport'].paddingBottom, '0px')
      assert.equal(
        await a.page.evaluate(
          () =>
            !!document
              .elementFromPoint(innerWidth / 2, innerHeight - 10)
              ?.closest('.management-entry'),
        ),
        false,
      )
      assert.equal(await a.page.locator('.management-entry-rail,.has-management-entry').count(), 0)
      await a.page.screenshot({
        path: new URL(`floating-${name}-${theme}-${viewport.width}-admin.png`, evidence).pathname,
      })
      await m.page.screenshot({
        path: new URL(`floating-${name}-${theme}-${viewport.width}-member.png`, evidence).pathname,
      })
      results.push({ theme, viewport, name, geometry: ag, entry, identical: true })
    }
    for (const f of [a, m]) {
      f.setPanel()
      await f.page.reload()
      await f.page.getByText('同一份合成接口资料', { exact: true }).waitFor()
      await f.page.locator('.curation-dock').waitFor()
      await settle(f.page)
    }
    assert.deepEqual(await geometry(a.page), await geometry(m.page), 'mini panel must be unchanged')
    await a.page.screenshot({
      path: new URL(`floating-panel-${theme}-${viewport.width}.png`, evidence).pathname,
    })
    for (const f of [a, m]) {
      await f.page.getByRole('button', { name: '展开进度摘要', exact: true }).click()
      await settle(f.page)
    }
    assert.deepEqual(
      await geometry(a.page),
      await geometry(m.page),
      'expanded panel must be unchanged',
    )
    for (const f of [a, m]) {
      await f.page.getByRole('button', { name: '关闭进度面板', exact: true }).click()
      await f.page.getByRole('button', { name: '开始新一轮整理', exact: true }).click()
      await f.page.getByRole('alertdialog').waitFor()
      await settle(f.page)
    }
    assert.deepEqual(
      await geometry(a.page),
      await geometry(m.page),
      'modal layout must be unchanged',
    )
    assert.equal(
      await a.page.locator('.management-entry').evaluate((e) => {
        const r = e.getBoundingClientRect()
        return !!document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.closest('.management-entry')
      }),
      false,
    )
    await a.page.screenshot({
      path: new URL(`floating-modal-${theme}-${viewport.width}.png`, evidence).pathname,
    })
    await a.page.keyboard.press('Escape')
    await a.page.getByRole('alertdialog').waitFor({ state: 'hidden' })
    await a.page.locator('.management-entry').focus()
    assert.equal(
      await a.page
        .locator('.management-entry span')
        .evaluate((e) => getComputedStyle(e).outlineStyle),
      'solid',
    )
    await a.page.evaluate(() => {
      localStorage.removeItem('nexofolio.session')
      window.dispatchEvent(new Event('nexofolio:session-cleared'))
    })
    await a.page.locator('.management-entry').waitFor({ state: 'hidden' })
    results.push({ theme, viewport, name: 'panel-modal-keyboard-signout', passed: true })
    await a.ctx.close()
    await m.ctx.close()
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(writes, [])
  await writeFile(
    new URL('floating-entry-result.json', evidence),
    JSON.stringify({ results, errors, writes }, null, 2),
  )
  console.log(JSON.stringify({ comparisons: results.length, errors, writes }, null, 2))
} finally {
  await browser.close()
}

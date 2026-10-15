// Synthetic browser acceptance. Every API request is intercepted; no business service is called.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5178'
const evidence = new URL('../../docs/reviews/document-lifecycle-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const env = '10000000-0000-4000-8000-000000000001'
const index = JSON.parse(
  (
    await readFile(new URL('../fixtures/document-navigation.json', import.meta.url), 'utf8')
  ).replaceAll('test-env', env),
)
const originalIndex = structuredClone(index)
const pid = 'fixture-navigation',
  base = `${origin}/projects/${pid}/interfaces`
const project = {
  project_id: pid,
  name: '隔离模拟 · 文档生命周期',
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
}
const environments = [{ id: env, name: '测试环境' }]
const user = (role) => ({
  id: `fixture-${role}`,
  account: `fixture-${role}`,
  display_name: role === 'member' ? '有权限用户' : '无项目权限用户',
  enabled: true,
})
const field = {
  location: { in: 'request_body' },
  path: [],
  types: ['object'],
  labels: [{ environment_id: env, label: { label: 'always' } }],
  differs_between_environments: false,
  declared: null,
  conflict: null,
}
const fields = [
  {
    key: 'request_body:',
    structure: field,
    name: '请求参数',
    description: '提交订单所需参数',
    details: [],
    unknowns: [],
    confirmation: 'candidate',
  },
  {
    key: 'request_body:customerId',
    structure: { ...field, path: [{ key: 'customerId' }], types: ['string'] },
    name: '客户编号',
    description: '客户的业务标识',
    details: ['使用目标客户的标识'],
    unknowns: ['选择规则待确认'],
    confirmation: 'candidate',
  },
]
const records = [],
  errors = [],
  results = []
let revoked = false
let lifecycle = { version: 0, reconciled_version: 0, decisions: [] }
function covers(d, target) {
  return d.retired && JSON.stringify(d.target) === JSON.stringify(target)
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
async function context(role) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  if (role)
    await ctx.addInitScript(
      (value) =>
        localStorage.setItem(
          'nexofolio.session',
          JSON.stringify({ token: value, expiresAt: '2099-01-01T00:00:00Z' }),
        ),
      role,
    )
  await ctx.route(`${origin}/api/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace(/^\/api/, ''),
      token = request.headers().authorization?.replace('Bearer ', '')
    records.push({ role: role || 'guest', token: token || null, path, method: request.method() })
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/v1/auth/login')
      return send({
        user: user('member'),
        token: 'member',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00Z',
        project_sync: { status: 'completed' },
      })
    if (path === `/v1/projects/${pid}/document-lifecycle`) {
      if (token !== 'member' || revoked) return send({ error: { message: '没有权限' } }, 403)
      if (request.method() === 'GET') return send(lifecycle)
      const body = request.postDataJSON()
      if (body.expected_version !== lifecycle.version)
        return send({ error: { message: '废弃状态已变化，请刷新后重试' } }, 409)
      lifecycle.version++
      lifecycle.decisions = lifecycle.decisions.filter(
        (d) => JSON.stringify(d.target) !== JSON.stringify(body.target),
      )
      lifecycle.decisions.push({
        target: body.target,
        reason: body.reason,
        retired: body.retired,
        version: lifecycle.version,
        actor: { kind: 'user', id: 'member', display_name: '合成操作人' },
        at: '2026-10-11T04:00:00Z',
        folders:
          body.target.kind === 'folder'
            ? [
                body.target.id,
                ...index.catalog.folders
                  .filter((f) => f.parent === body.target.id)
                  .map((f) => f.id),
              ]
            : [],
      })
      return send(lifecycle)
    }
    if (request.method() !== 'GET')
      return send({ error: { message: 'Synthetic fixture rejects mutations' } }, 405)
    if (path === '/v1/auth/me')
      return ['member', 'outsider'].includes(token)
        ? send({ user: user(token) })
        : send({ error: { message: 'expired' } }, 401)
    if (path === `/v1/public/projects/${pid}/document`)
      return send({
        ...index,
        lifecycle,
        project: { project_id: pid, name: project.name, status: 'doing', environments },
      })
    if (path.startsWith(`/v1/public/projects/${pid}/endpoints/`)) {
      const endpoint = path.split('/').at(-1),
        entry = index.entries.find((e) => e.interface_id === endpoint)
      if (!entry) return send({ error: { message: '接口不存在' } }, 404)
      return send({
        project_id: pid,
        endpoint_id: endpoint,
        environment_id: url.searchParams.get('environment_id'),
        name: entry.name,
        purpose: entry.purpose,
        description: '正式接口说明',
        unknowns: [],
        method: entry.method,
        path: entry.path,
        fields,
      })
    }
    if (path.startsWith(`/v1/projects/${pid}`)) {
      if (token !== 'member' || revoked)
        return send({ error: { message: '没有项目权限' } }, token ? 403 : 401)
      if (path === `/v1/projects/${pid}`) return send(project)
      if (path.endsWith('/environments'))
        return send({ items: environments, total: 1, page: 1, limit: 100 })
      if (path === `/v1/projects/${pid}/document`) return send({ ...index, lifecycle })
      if (path.endsWith('/catalog')) return send(index.catalog)
      if (path.endsWith('/endpoints'))
        return send({ endpoints: index.entries.map((e) => e.summary) })
      if (path.includes('/curate/candidates/retirement-old')) {
        if (path.endsWith('/operations')) return send({ events: [], names_unavailable: false })
        const view = {
          endpoints: originalIndex.entries.map((e) => e.interface_id),
          folders: originalIndex.catalog.folders,
          placements: originalIndex.entries
            .filter((e) => e.folderId)
            .map((e) => ({
              endpoint: e.interface_id,
              folder: e.folderId,
              author: { by: 'curate', pass: 'fixture', model: null },
              at: '2026-10-10T00:00:00Z',
            })),
          notes: [],
          fields: [],
          links: [],
        }
        return send({
          id: 'retirement-old',
          project_id: pid,
          target: null,
          parent: null,
          state: 'partial',
          created_at: '2026-10-10T00:00:00Z',
          updated_at: '2026-10-10T00:00:00Z',
          base_hash: 'fixture',
          base: { ...view, lifecycle: { version: 0, reconciled_version: 0, decisions: [] } },
          view,
          batches: [],
          progress: {
            status: 'failed',
            candidate_id: 'retirement-old',
            total: view.endpoints.length,
          },
          applied_rounds: [],
          reviewed_by: null,
          operations: [],
          execution_input: {
            prepared: {
              facts: originalIndex.entries.map((e) => ({
                summary: e.summary,
                fields: fields.map((f) => f.structure),
                aliases: [],
                addresses: [],
                examples: [],
                requests: [],
              })),
            },
          },
        })
      }
      if (path.endsWith('/curate/candidates')) return send([])
      if (path.endsWith('/curate'))
        return send({
          status: 'idle',
          stage: null,
          completed: 0,
          total: 0,
          generated: 0,
          unchanged: 0,
          message: null,
        })
      if (path.endsWith('/catalog/unclassified')) {
        const items = index.entries.filter((e) => !e.folderId)
        return send({ items, total: items.length, page: 1, limit: 100 })
      }
      if (path.endsWith('/catalog/interfaces')) {
        const items = index.entries.filter(
          (e) => e.folderId === url.searchParams.get('directory_id'),
        )
        return send({ items, total: items.length, page: 1, limit: 100 })
      }
      if (path.includes('/endpoints/')) {
        const endpoint = path.split('/').at(-1),
          entry = index.entries.find((e) => e.interface_id === endpoint)
        if (!entry) return send({ error: { message: 'missing' } }, 404)
        return send({
          facts: {
            summary: entry.summary,
            fields: fields.map((f) => f.structure),
            aliases: [],
            addresses: [],
            examples: [],
            requests: [],
          },
          knowledge: {
            note: {
              endpoint,
              name: entry.name,
              purpose: 'MEMBER_ONLY_DESCRIPTION',
              context: {},
              author: { by: 'person', user: 'fixture-member' },
              at: '2026-10-10T00:00:00Z',
            },
            fields: [],
            links: [],
            path: [],
          },
        })
      }
    }
    return send({ error: { message: 'Synthetic fixture has no such endpoint' } }, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  return { ctx, page }
}
async function check(name, fn) {
  await fn()
  results.push({ name, passed: true })
  console.log('PASS', name)
}

try {
  const { ctx, page } = await context('member')
  const targetUrl = `${base}/endpoints/endpoint-0?env=${env}`
  await page.goto(targetUrl)
  await page.getByRole('button', { name: '开始新一轮整理', exact: true }).waitFor()
  await page.locator('.document-definition-title h2').waitFor()
  const original = await page.locator('.document-definition-title h2').textContent()
  await check(
    'endpoint retirement immediately strikes only the name and inherited fields; undo restores state',
    async () => {
      await page
        .locator('.document-description-action')
        .getByRole('button', { name: /更多操作/ })
        .click()
      await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
      await page.getByRole('textbox', { name: '废弃原因' }).fill('旧接口已被替代，保留历史样本')
      await page.getByRole('button', { name: '确认废弃', exact: true }).click()
      await page.getByRole('button', { name: '废弃内容（1）', exact: true }).waitFor()
      assert.match(
        await page
          .locator('.document-definition-title h2')
          .evaluate((e) => getComputedStyle(e).textDecorationLine),
        /line-through/,
      )
      assert.ok((await page.locator('.field-identity code.lifecycle-retired-name').count()) > 0)
      assert.equal(await page.getByText('已废弃', { exact: true }).count(), 0)
      assert.equal(await page.getByText('随接口废弃', { exact: true }).count(), 0)
      await page.locator('.field-structure tbody .lifecycle-trigger').first().click()
      await page.getByRole('menuitem', { name: '管理所属对象的废弃状态' }).waitFor()
      await page.keyboard.press('Escape')
      await page.screenshot({
        path: new URL('endpoint-retired.png', evidence).pathname,
        fullPage: true,
      })
      await page.getByRole('button', { name: '废弃内容（1）', exact: true }).click()
      await page.getByRole('button', { name: '撤销废弃', exact: true }).click()
      await page.getByRole('button', { name: '确认撤销废弃', exact: true }).click()
      await page.getByRole('button', { name: '废弃内容（0）', exact: true }).waitFor()
      assert.equal(await page.locator('.document-definition-title h2').textContent(), original)
      assert.ok(
        !(
          await page
            .locator('.document-definition-title h2')
            .evaluate((e) => getComputedStyle(e).textDecorationLine)
        ).includes('line-through'),
      )
    },
  )
  await check(
    'object field retirement includes descendants, has no duplicate inherited count, and can be undone',
    async () => {
      await page.locator('.field-structure tbody .lifecycle-trigger').first().click()
      await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
      await page.getByRole('textbox', { name: '废弃原因' }).fill('旧请求对象')
      await page.getByRole('button', { name: '确认废弃', exact: true }).click()
      await page.getByRole('button', { name: '废弃内容（1）', exact: true }).waitFor()
      assert.equal(await page.locator('.field-identity code.lifecycle-retired-name').count(), 2)
      assert.ok(
        !(
          await page
            .locator('.document-definition-title h2')
            .evaluate((e) => getComputedStyle(e).textDecorationLine)
        ).includes('line-through'),
      )
      await page.getByRole('button', { name: '废弃内容（1）', exact: true }).click()
      await page.getByRole('button', { name: '撤销废弃', exact: true }).click()
      await page.getByRole('button', { name: '确认撤销废弃', exact: true }).click()
      await page.getByRole('button', { name: '废弃内容（0）', exact: true }).waitFor()
    },
  )
  await check(
    'directory retirement leaves member endpoints active and offers original historical URL',
    async () => {
      await page.goto(`${base}/folders/root?env=${env}`)
      await page.locator('.document-overview-title .lifecycle-trigger').click()
      await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
      await page.getByRole('textbox', { name: '废弃原因' }).fill('目录结构已过时')
      await page.getByRole('button', { name: '确认废弃', exact: true }).click()
      await page.getByRole('button', { name: '废弃内容（1）', exact: true }).waitFor()
      assert.equal(await page.locator('.interface-item-content .lifecycle-retired-name').count(), 0)
      assert.ok((await page.locator('.document-folder-name.lifecycle-retired-name').count()) >= 2)
      // Simulate atomic publication: effective interfaces are unplaced, folders retained for history.
      lifecycle.reconciled_version = lifecycle.version
      index.entries.forEach((e) => {
        if (['root', 'child'].includes(e.folderId)) e.folderId = null
      })
      index.catalog.unplaced = index.entries.filter((e) => !e.folderId).length
      await page.reload()
      await page.locator('.document-overview-title h2.lifecycle-retired-name').waitFor()
      assert.equal(await page.locator('.interface-list-scroll [data-folder-id="root"]').count(), 0)
      await page.getByRole('checkbox', { name: '显示已废弃' }).check()
      await page.locator('.interface-list-scroll [data-folder-id="root"]').waitFor()
      await page.screenshot({
        path: new URL('directory-history.png', evidence).pathname,
        fullPage: true,
      })
    },
  )
  await check('keyboard menu, narrow viewport, and dark styling remain usable', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(targetUrl)
    await page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).waitFor()
    await page.locator('.brand-transition').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '切换深色模式', exact: true }).click()
    await page.locator('.document-description-action .lifecycle-trigger').focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: '废弃', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('menu').waitFor({ state: 'hidden' })
    await page.screenshot({ path: new URL('mobile-dark.png', evidence).pathname, fullPage: true })
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
  })
  await check(
    'stale review keeps its historical document and hides apply and resume actions',
    async () => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${base}/curation/retirement-old?env=${env}`)
      await page.getByText(/本轮基于旧版本/).waitFor()
      await page.locator('.brand-transition').waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '本轮操作', exact: true }).click()
      assert.equal(await page.getByRole('menuitem', { name: '续跑本轮', exact: true }).count(), 0)
      assert.equal(await page.getByRole('menuitem', { name: /应用/ }).count(), 0)
      await page.getByRole('menuitem', { name: '查看现行文档', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('menu').waitFor({ state: 'hidden' })
      await page.screenshot({
        path: new URL('stale-review.png', evidence).pathname,
        fullPage: true,
      })
    },
  )
  await check(
    'a concurrent retirement cannot turn an open retire confirmation into undo',
    async () => {
      await page.goto(targetUrl)
      await page.locator('.document-description-action .lifecycle-trigger').click()
      await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
      await page.getByRole('textbox', { name: '废弃原因' }).fill('my original intent')
      lifecycle.version++
      const decision = {
        target: { kind: 'endpoint', id: 'endpoint-0' },
        retired: true,
        reason: 'another operator',
        version: lifecycle.version,
        actor: { kind: 'user', display_name: 'other' },
        at: '2026-10-11T05:00:00Z',
        folders: [],
      }
      lifecycle.decisions = lifecycle.decisions.filter(
        (d) => !(d.target.kind === 'endpoint' && d.target.id === 'endpoint-0'),
      )
      lifecycle.decisions.push(decision)
      const version = lifecycle.version
      await page.getByRole('button', { name: '确认废弃', exact: true }).click()
      await page
        .getByRole('dialog')
        .getByText('状态已变化，请关闭弹窗后重新选择操作。', { exact: true })
        .waitFor()
      assert.equal(
        await page.getByRole('button', { name: '确认废弃', exact: true }).isDisabled(),
        true,
      )
      assert.equal(await page.getByRole('button', { name: '确认撤销废弃', exact: true }).count(), 0)
      assert.equal(lifecycle.version, version)
      await page.getByRole('dialog').getByRole('button', { name: '关闭弹窗', exact: true }).click()
      decision.retired = false
      decision.version = ++lifecycle.version
    },
  )
  await check(
    'a denied write removes management controls and returns to public reading',
    async () => {
      await page.goto(targetUrl)
      await page.locator('.document-description-action .lifecycle-trigger').click()
      await page.getByRole('menuitem', { name: '废弃', exact: true }).click()
      await page.getByRole('textbox', { name: '废弃原因' }).fill('must not be written')
      const version = lifecycle.version
      revoked = true
      await page.getByRole('button', { name: '确认废弃', exact: true }).click()
      await page.getByText('只读查看', { exact: true }).waitFor()
      assert.equal(await page.locator('.lifecycle-trigger').count(), 0)
      assert.equal(await page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).count(), 0)
      assert.equal(lifecycle.version, version)
      revoked = false
    },
  )
  await ctx.close()
  await check(
    'public reader can see retired history and reasons but has no management menu',
    async () => {
      const { ctx, page } = await context()
      await page.goto(`${base}/folders/root?env=${env}`)
      await page.getByText('只读查看', { exact: true }).waitFor()
      await page.locator('.document-overview-title h2.lifecycle-retired-name').waitFor()
      assert.equal(await page.locator('.lifecycle-trigger').count(), 0)
      await page.getByRole('button', { name: '废弃内容（1）' }).click()
      await page.getByText('目录结构已过时', { exact: true }).last().waitFor()
      assert.equal(await page.getByRole('button', { name: '撤销废弃', exact: true }).count(), 0)
      await page.screenshot({
        path: new URL('public-history.png', evidence).pathname,
        fullPage: true,
      })
      await ctx.close()
    },
  )
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify({ results, errors, requests: records.map(({ token, ...r }) => r) }, null, 2),
  )
} finally {
  await browser.close()
}

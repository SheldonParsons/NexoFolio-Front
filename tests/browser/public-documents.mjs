// Synthetic browser acceptance. Every API request is intercepted; no business service is called.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/public-document-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const env = '10000000-0000-4000-8000-000000000001'
const index = JSON.parse(
  (
    await readFile(new URL('../fixtures/document-navigation.json', import.meta.url), 'utf8')
  ).replaceAll('test-env', env),
)
const pid = 'fixture-navigation',
  base = `${origin}/projects/${pid}/interfaces`
const project = {
  project_id: pid,
  name: '隔离模拟 · 公开只读文档',
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
  labels: [],
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
    if (request.method() !== 'GET')
      return send({ error: { message: 'Synthetic fixture rejects mutations' } }, 405)
    if (path === '/v1/auth/me')
      return ['member', 'outsider'].includes(token)
        ? send({ user: user(token) })
        : send({ error: { message: 'expired' } }, 401)
    if (path === `/v1/public/projects/${pid}/document`)
      return send({
        ...index,
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
      if (path === `/v1/projects/${pid}/document`) return send(index)
      if (path.endsWith('/catalog')) return send(index.catalog)
      if (path.endsWith('/endpoints'))
        return send({ endpoints: index.entries.map((e) => e.summary) })
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
async function readonly(page) {
  await page.getByText('只读查看', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '开始新一轮整理' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '整理结果', exact: true }).count(), 0)
  assert.equal(await page.getByRole('tab', { name: /真实样本/ }).count(), 0)
  assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(), 0)
}
try {
  const { ctx, page } = await context()
  await check(
    'guest direct endpoint/env keeps reading without login; nested fields still expand',
    async () => {
      await page.goto(`${base}/endpoints/endpoint-0?env=${env}&tab=examples&sample=private`)
      await readonly(page)
      await page.getByText('客户的业务标识', { exact: true }).waitFor()
      await page.getByRole('button', { name: '收起 整个报文' }).click()
      assert.equal(await page.getByText('客户的业务标识', { exact: true }).count(), 0)
      await page.getByRole('button', { name: '展开 整个报文' }).click()
      await page.getByText('客户的业务标识', { exact: true }).waitFor()
      await page.screenshot({
        path: new URL('guest-endpoint.png', evidence).pathname,
        fullPage: true,
      })
      assert.ok(!records.some((r) => /\/v1\/projects\/.+\/(curate|endpoints)/.test(r.path)))
    },
  )
  await check(
    'directory navigation, search and copied-link environment work for guests',
    async () => {
      await page.goto(`${base}/folders/child?env=${env}`)
      await readonly(page)
      await page.locator('.document-overview-title h2').waitFor()
      await page.getByRole('searchbox').fill('查询技术咨询')
      assert.ok(
        await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').count(),
      )
      await page.locator('.interface-list-scroll [data-endpoint-id="endpoint-0"]').click()
      await page.getByText('客户的业务标识', { exact: true }).waitFor()
      assert.ok(page.url().includes(`env=${env}`))
      await page.setViewportSize({ width: 390, height: 844 })
      await page.getByText('客户的业务标识', { exact: true }).waitFor()
      assert.equal(await page.locator('.workspace-header').count(), 1)
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      await page.screenshot({
        path: new URL('guest-mobile.png', evidence).pathname,
        fullPage: true,
      })
      assert.ok(await page.getByRole('link', { name: '返回接口列表' }).isVisible())
      await page.setViewportSize({ width: 1280, height: 900 })
    },
  )
  await check(
    'login from the same document restores member controls; logout returns to readonly in place',
    async () => {
      await page
        .locator('.workspace-header')
        .getByRole('button', { name: '登录', exact: true })
        .click()
      await page.getByRole('dialog').waitFor()
      await page.getByLabel('账号', { exact: true }).fill('fixture-member')
      await page.getByLabel('密码', { exact: true }).fill('synthetic-password')
      const remember = page.getByLabel('记住账号和密码')
      if (await remember.isChecked()) await remember.uncheck()
      await page.getByRole('button', { name: '登录并进入' }).click()
      await page.getByRole('button', { name: '开始新一轮整理' }).waitFor()
      await page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).waitFor()
      assert.ok(page.url().includes('/endpoints/endpoint-0'))
      await page.getByRole('button', { name: '打开个人菜单' }).click()
      await page.getByRole('menuitem', { name: '退出登录' }).click()
      await readonly(page)
      assert.ok(page.url().includes('/endpoints/endpoint-0'))
      assert.equal(await page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).count(), 0)
    },
  )
  await ctx.close()
  for (const role of ['outsider', 'expired']) {
    const { ctx, page } = await context(role)
    await check(
      `${role} session reads public fields without private samples or progress`,
      async () => {
        const before = records.length
        await page.goto(`${base}/endpoints/endpoint-0?env=${env}`)
        await readonly(page)
        await page.getByText('客户的业务标识', { exact: true }).waitFor()
        assert.ok(
          !records
            .slice(before)
            .some((r) =>
              /\/v1\/projects\/.+\/(endpoints|curate|catalog|environments)/.test(r.path),
            ),
        )
        if (role === 'outsider') await page.getByRole('button', { name: '打开个人菜单' }).waitFor()
        await page.screenshot({
          path: new URL(`${role}-endpoint.png`, evidence).pathname,
          fullPage: true,
        })
      },
    )
    await ctx.close()
  }
  const member = await context('member')
  await check('revoked permission drops the member view and cached private content', async () => {
    await member.page.goto(`${base}/endpoints/endpoint-0?env=${env}`)
    await member.page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).waitFor()
    revoked = true
    await member.page.locator('.interface-list-scroll [data-endpoint-id="endpoint-1"]').click()
    await readonly(member.page)
    assert.equal(await member.page.getByText('MEMBER_ONLY_DESCRIPTION', { exact: true }).count(), 0)
  })
  await member.ctx.close()
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('result.json', evidence),
    JSON.stringify({ results, requests: records, errors }, null, 2),
  )
} finally {
  await browser.close()
}

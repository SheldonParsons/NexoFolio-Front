// Real browser UI acceptance with intercepted synthetic HTTP responses; no business service calls.
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/public-document-parity/', import.meta.url)
await mkdir(evidence, { recursive: true })
const env = '10000000-0000-4000-8000-000000000001',
  archive = '20000000-0000-4000-8000-000000000001'
const index = JSON.parse(
  (
    await readFile(new URL('../fixtures/document-navigation.json', import.meta.url), 'utf8')
  ).replaceAll('test-env', env),
)
const pid = 'fixture-navigation',
  base = `${origin}/projects/${pid}/interfaces`
const project = {
  project_id: pid,
  name: '隔离模拟 · 文档一致性',
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
const structure = {
  location: { in: 'request_body' },
  path: [],
  types: ['object'],
  labels: [{ environment_id: env, label: { label: 'required' } }],
  differs_between_environments: false,
  declared: null,
  conflict: null,
}
const fields = [structure, { ...structure, path: [{ key: 'customerId' }], types: ['string'] }]
const at = '2026-10-15T00:00:00Z'
function detail(endpoint) {
  const entry = index.entries.find(
    (e) => e.interface_id === (endpoint === 'alias' ? 'endpoint-0' : endpoint),
  )
  if (!entry) return null
  return {
    facts: {
      summary: entry.summary,
      aliases: ['alias'],
      addresses: [],
      fields,
      examples: [
        {
          id: 'sample-1',
          environment_id: env,
          address: 'https://synthetic.example',
          status: 200,
          calls: 1,
          structure_id: 'one',
          first_seen: at,
          last_seen: at,
        },
      ],
      requests: [],
    },
    knowledge: {
      note: {
        endpoint: entry.interface_id,
        name: entry.name,
        purpose: '提交订单资料',
        context: { description: '接口补充业务说明', unknowns: ['订单状态要求尚未验证'] },
        author: { by: 'person', user: 'fixture-member' },
        at,
      },
      fields: fields.map((f, i) => ({
        endpoint: entry.interface_id,
        path: i ? 'request_body:customerId' : 'request_body:',
        text: i ? '客户的业务标识' : '提交订单所需参数',
        values: [],
        author: { by: 'person', user: 'fixture-member' },
        at,
        context: {
          display_name: i ? '客户编号' : '请求参数',
          location: f.location,
          field_path: i ? 'customerId' : '',
          input_hash: null,
          evidence: [],
          completion: {
            name: { state: 'filled', reason: null },
            description: { state: 'filled', reason: null },
          },
          meaning: {
            details: ['使用目标客户的标识'],
            unknowns: ['选择规则尚未验证'],
            confirmation: 'candidate',
            unit: null,
          },
          ...(i
            ? {
                observations: {
                  archive_id: archive,
                  total: 1,
                  hash: 'fixture',
                  states: { full: 1 },
                },
              }
            : {}),
        },
      })),
      links: [],
      path: [],
    },
    retired_source_count: 0,
  }
}
const observation = {
  context: { page: 'synthetic' },
  fact: {
    kind: 'exchange',
    request: {
      method: 'POST',
      url: 'https://synthetic.example/orders',
      headers: { complete: true, entries: [['Authorization', 'Bearer SYNTHETIC_AUTH']] },
      body: {
        state: 'full',
        media_type: 'application/json',
        content: { encoding: 'text', data: '{"customerId":"customer-101"}' },
      },
    },
    response: {
      status: 200,
      body: {
        state: 'full',
        media_type: 'application/json',
        content: { encoding: 'text', data: '{"result":"SYNTHETIC_RESPONSE"}' },
      },
    },
  },
}
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
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
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
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace(/^\/api/, ''),
      token = req.headers().authorization?.replace('Bearer ', '')
    records.push({ role: role || 'guest', path, method: req.method() })
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/v1/telemetry') return route.fulfill({ status: 204, body: '' })
    if (req.method() !== 'GET')
      return send({ error: { message: 'Synthetic fixture rejects mutations' } }, 405)
    if (path === '/v1/auth/me')
      return ['member', 'outsider'].includes(token)
        ? send({ user: user(token) })
        : send({ error: { message: 'expired' } }, 401)
    if (path === `/v1/public/projects/${pid}/document`)
      return send({ ...index, project: { ...project, environments } })
    if (path === `/v1/projects/${pid}`)
      return token === 'member' && !revoked
        ? send(project)
        : send({ error: { message: '没有操作权限' } }, token ? 403 : 401)
    const memberPrefix = `/v1/projects/${pid}`,
      publicPrefix = `/v1/public/projects/${pid}`
    if (path.startsWith(memberPrefix) && (token !== 'member' || revoked))
      return send({ error: { message: '没有操作权限' } }, token ? 403 : 401)
    if (path === `${memberPrefix}/environments`)
      return send({ items: environments, total: 1, page: 1, limit: 100 })
    if (path === `${memberPrefix}/document`) return send(index)
    if (path === `${memberPrefix}/curate/tasks` || path === `${memberPrefix}/curate/candidates`)
      return send([])
    if (path === `${memberPrefix}/curate`)
      return send({
        status: 'idle',
        stage: null,
        completed: 0,
        total: 0,
        generated: 0,
        unchanged: 0,
        message: null,
      })
    if ([memberPrefix, publicPrefix].some((p) => path.startsWith(p + '/endpoints/'))) {
      const parts = path.split('/'),
        endpoint = parts[parts.indexOf('endpoints') + 1]
      if (!detail(endpoint)) return send({ error: { message: '接口不存在' } }, 404)
      if (path.endsWith('/examples/sample-1')) return send({ observation })
      if (path.endsWith('/field-values'))
        return url.searchParams.has('value_id')
          ? send({ json: '9007199254740993' })
          : send({
              summary: { archive_id: archive, total: 1, hash: 'fixture', states: { full: 1 } },
              items: [
                {
                  id: 'value-1',
                  value_type: 'number',
                  representation: 'json',
                  preview: '9007199254740993',
                  preview_truncated: false,
                  occurrences: 1,
                  sources: [{ example: 'sample-1' }],
                },
              ],
              offset: 0,
              limit: 12,
              has_more: false,
            })
      return send(detail(endpoint))
    }
    return send({ error: { message: 'Synthetic fixture has no such endpoint' } }, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page }
}
async function readonly(page) {
  await page.getByText('只读查看', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '开始新一轮整理' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '重新整理接口' }).count(), 0)
  assert.equal(await page.locator('.lifecycle-field-action').count(), 0)
  await page.getByRole('tab', { name: /真实样本/ }).waitFor()
  assert.equal(await page.getByRole('tab', { name: /真实样本/ }).count(), 1)
}
let baseline
try {
  for (const role of ['member', undefined, 'outsider', 'expired']) {
    const { ctx, page } = await context(role)
    await page.goto(`${base}/endpoints/endpoint-0?env=${env}`)
    await page.getByText('客户的业务标识', { exact: true }).waitFor()
    if (role === 'member') await page.getByRole('button', { name: '开始新一轮整理' }).waitFor()
    else await readonly(page)
    await page.getByRole('button', { name: '补充说明与尚未验证的事项' }).click()
    await page.getByText('接口补充业务说明', { exact: true }).waitFor()
    const content = await page.locator('#document-detail').evaluate((el) => ({
      title: el.querySelector('h2')?.textContent.trim(),
      path: el.querySelector('.endpoint-address-path')?.textContent.trim(),
      fields: [...el.querySelectorAll('.field-structure tbody > tr:not(.field-evidence-row)')].map(
        (row) => [...row.cells].slice(0, 4).map((c) => c.textContent.replace(/\s+/g, ' ').trim()),
      ),
      description: el
        .querySelector('.document-endpoint-notes-body')
        ?.textContent.replace(/\s+/g, ' ')
        .trim(),
    }))
    assert.ok(content.path)
    if (!baseline) baseline = content
    else assert.deepEqual(content, baseline)
    await page.getByRole('button', { name: '查看观测值', exact: true }).click()
    await page.getByText('9007199254740993', { exact: true }).waitFor()
    await page.getByRole('button', { name: '复制完整值', exact: true }).click()
    await page.getByText('已复制完整值（JSON，保留类型）', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '9007199254740993')
    await page.screenshot({
      path: new URL(`${role || 'guest'}-fields.png`, evidence).pathname,
      fullPage: true,
    })
    await page.getByRole('tab', { name: /真实样本/ }).click()
    await page.getByRole('button', { name: /样本 1/ }).click()
    await page.getByText(/SYNTHETIC_RESPONSE/).waitFor()
    await page.getByRole('button', { name: '请求数据', exact: true }).click()
    await page.getByText(/SYNTHETIC_AUTH/).waitFor()
    await page.screenshot({
      path: new URL(`${role || 'guest'}-sample.png`, evidence).pathname,
      fullPage: true,
    })
    results.push({
      role: role || 'guest',
      full_content_equal: true,
      observed_value: true,
      sample: true,
      writes_hidden: role !== 'member',
    })
    if (!role) {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({
        path: new URL('guest-mobile.png', evidence).pathname,
        fullPage: true,
      })
      assert.ok(await page.getByRole('button', { name: '返回接口列表', exact: true }).isVisible())
    }
    if (role === 'member') {
      revoked = true
      await page.reload()
      await readonly(page)
      await page.getByRole('tab', { name: /^字段/ }).click()
      await page.getByText('客户的业务标识', { exact: true }).waitFor()
      await page.getByRole('tab', { name: /真实样本/ }).click()
      await page.getByRole('button', { name: /样本 1/ }).click()
      await page.getByText(/SYNTHETIC_RESPONSE/).waitFor()
      results.push({ role: 'revoked-member', sample_still_readable: true, writes_hidden: true })
      revoked = false
    }
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  assert.equal(records.filter((r) => r.method !== 'GET' && r.path !== '/v1/telemetry').length, 0)
  for (const role of ['guest', 'outsider', 'expired'])
    assert(
      !records.some(
        (r) =>
          r.role === role &&
          /\/v1\/projects\/[^/]+\/(curate|endpoints|document-lifecycle)/.test(r.path),
      ),
    )
  console.log(JSON.stringify({ results, page_errors: errors, requests: records.length }))
  await writeFile(
    new URL('results.json', evidence),
    JSON.stringify({ results, errors, records }, null, 2),
  )
} finally {
  await browser.close()
}

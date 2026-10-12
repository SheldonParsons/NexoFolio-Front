// All API traffic is synthetic and intercepted, including every destructive request.
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    '/Users/sheldon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
)
const origin = process.env.NAVIGATION_ORIGIN || 'http://127.0.0.1:5173'
const evidence = new URL('../../docs/reviews/private-console-evidence/', import.meta.url)
await mkdir(evidence, { recursive: true })
const id = '10000000-0000-4000-8000-000000000001',
  next = '10000000-0000-4000-8000-000000000002'
const source = { project_id: id, name: '云售后', status: 'doing' }
const secondSource = {
  project_id: '10000000-0000-4000-8000-000000000003',
  name: '售后共用',
  status: 'doing',
}
const project = (pid, name, origin = 'zentao') => ({
  origin,
  project_id: pid,
  name,
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
})
const calls = [],
  errors = [],
  results = []
async function settle(page) {
  await page.getByRole('dialog').evaluate(async (element) => {
    const animations = element
      .getAnimations({ subtree: true })
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.effect?.getComputedTiming().iterations !== Infinity,
      )
    await Promise.race([
      Promise.all(animations.map((animation) => animation.finished.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 600)),
    ])
  })
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('[role="dialog"]')).opacity === '1',
  )
}

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
async function context(role, capability = true, viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript(
    (token) =>
      localStorage.setItem(
        'nexofolio.session',
        JSON.stringify({ token, expiresAt: '2099-01-01T00:00:00Z' }),
      ),
    role,
  )
  let projects = [project(id, '云售后'), project(secondSource.project_id, secondSource.name)],
    managed,
    staleNextEdit = false,
    failCreate = false,
    running = 0,
    clearAttempt = 0,
    completeClear
  await ctx.route(`${origin}/api/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace(/^\/api/, ''),
      method = request.method()
    calls.push({
      role,
      path,
      method,
      body: ['POST', 'PATCH'].includes(method) ? request.postDataJSON() : null,
    })
    const send = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/v1/auth/me')
      return send({
        user: {
          id: role,
          account: role === 'admin' ? 'A80646' : role === 'no-capability' ? 'a80646' : 'member',
          display_name: '隔离模拟用户',
          enabled: true,
        },
        capabilities: capability ? { manage_projects: true } : {},
      })
    if (path === '/v1/projects')
      return send({ items: projects, total: projects.length, page: 1, limit: 10 })
    if (path.startsWith('/v1/project-management/')) {
      if (role !== 'admin' || !capability) return send({ error: { message: '资源不存在' } }, 404)
      if (path.endsWith('/permission-sources'))
        return send({ items: [source, secondSource], total: 2, page: 1, limit: 100 })
      if (path.endsWith('/projects') && method === 'GET') {
        const filtered = projects.filter(
          (item) =>
            item.name.includes(url.searchParams.get('q') || '') &&
            (!url.searchParams.get('origin') || item.origin === url.searchParams.get('origin')),
        )
        const limit = Number(url.searchParams.get('limit')),
          page = Number(url.searchParams.get('page'))
        return send({
          items: filtered.slice((page - 1) * limit, page * limit).map((item) => ({
            ...item,
            permission_sources: item.origin === 'local' ? managed.permission_sources : [],
          })),
          total: filtered.length,
          page,
          limit,
        })
      }
      if (path.endsWith('/projects') && method === 'POST') {
        if (failCreate) {
          failCreate = false
          return send({ error: { message: '模拟创建失败，输入保留。' } }, 503)
        }
        const body = request.postDataJSON()
        assert.equal(body.name, '巴西售后')
        assert.deepEqual(body.permission_source_project_ids, [id, secondSource.project_id])
        projects.push(project(next, body.name, 'local'))
        managed = {
          project_id: next,
          name: body.name,
          permission_sources: [source, secondSource],
          revision: 1,
        }
        return send(managed, 201)
      }
      if (path === `/v1/project-management/projects/${next}`) {
        if (method === 'GET') return send(managed)
        if (method === 'PATCH') {
          const body = request.postDataJSON()
          if (staleNextEdit) {
            staleNextEdit = false
            managed.revision++
            return send({ error: { message: '版本冲突' } }, 409)
          }
          assert.equal(body.revision, managed.revision)
          managed = {
            ...managed,
            name: body.name,
            permission_sources: [source, secondSource].filter((item) =>
              body.permission_source_project_ids.includes(item.project_id),
            ),
            revision: managed.revision + 1,
          }
          projects = projects.map((item) =>
            item.project_id === next ? { ...item, name: managed.name } : item,
          )
          return send(managed)
        }
      }
      if (path.endsWith('/content'))
        return send({
          interfaces: 12,
          structures: 31,
          folders: 4,
          curation_results: 3,
          running_curations: running,
        })
      if (path.endsWith('/clear') && method === 'POST') {
        assert.equal(request.postDataJSON().confirmation, '云售后')
        clearAttempt++
        if (clearAttempt === 1) {
          await new Promise((resolve) => {
            completeClear = resolve
          })
          return send({ error: { message: '模拟清空失败，内容保持原状。' } }, 503)
        }
        return send({
          cleared: {
            interfaces: 12,
            structures: 31,
            folders: 4,
            curation_results: 3,
            running_curations: 0,
          },
        })
      }
    }
    return send({ error: { message: 'Synthetic fixture rejects unrelated request' } }, 404)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (error) => errors.push({ role, message: error.message }))
  await page.goto(`${origin}/projects`)
  await page.getByRole('heading', { name: '全部项目', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '创建项目', exact: true }).count(), 0)
  if (role === 'admin' && capability) {
    await page.getByRole('link', { name: '管理中心', exact: true }).click()
    await page.getByRole('heading', { name: '项目管理', exact: true }).waitFor()
    await page.locator('.brand-transition').waitFor({ state: 'hidden' })
  }
  return {
    ctx,
    page,
    failCreation: () => {
      failCreate = true
    },
    setRunning: (value) => {
      running = value
    },
    finishFailure: () => completeClear?.(),
    clearAttempts: () => clearAttempt,
    conflictOnEdit: () => {
      staleNextEdit = true
    },
    revoke: () => {
      capability = false
    },
  }
}
try {
  for (const [role, capability] of [
    ['member', true],
    ['no-capability', false],
  ]) {
    const { ctx, page } = await context(role, capability)
    await page.getByRole('button', { name: '云售后', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '创建项目', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '管理云售后', exact: true }).count(), 0)
    assert.equal(
      calls.filter((call) => call.role === role && call.path.startsWith('/v1/project-management'))
        .length,
      0,
    )
    results.push({ scenario: role, passed: true })
    await ctx.close()
  }
  const admin = await context('admin'),
    { page } = admin
  await page.getByRole('button', { name: '创建项目', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('项目名称', { exact: true }).fill('巴西售后')
  await dialog.getByRole('checkbox', { name: '云售后', exact: true }).check()
  await dialog.getByRole('checkbox', { name: '售后共用', exact: true }).check()
  await dialog.getByLabel('项目名称', { exact: true }).click()
  await settle(page)
  await page.screenshot({ path: new URL('create-project.png', evidence).pathname })
  admin.failCreation()
  await dialog.getByRole('button', { name: '创建项目', exact: true }).click()
  await dialog.getByRole('alert').getByText('模拟创建失败，输入保留。').waitFor()
  assert.equal(await dialog.getByLabel('项目名称', { exact: true }).inputValue(), '巴西售后')
  await dialog.getByRole('button', { name: '创建项目', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('link', { name: '巴西售后', exact: true }).waitFor()
  await page.getByRole('button', { name: '管理云售后', exact: true }).click()
  assert.equal(await page.getByRole('menuitem', { name: '编辑项目', exact: true }).count(), 0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '编辑项目', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: '云售后', exact: true }).waitFor()
  await dialog.getByLabel('项目名称', { exact: true }).fill('巴西售后业务')
  await dialog.getByRole('checkbox', { name: '云售后', exact: true }).uncheck()
  await settle(page)
  await page.screenshot({ path: new URL('edit-project.png', evidence).pathname })
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('link', { name: '巴西售后业务', exact: true }).waitFor()
  await page.getByRole('button', { name: '编辑项目', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox', { name: '售后共用', exact: true }).waitFor()
  await dialog.getByLabel('项目名称', { exact: true }).fill('冲突窗口里的修改')
  admin.conflictOnEdit()
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click()
  await dialog.getByRole('alert').waitFor()
  assert.equal(
    await dialog.getByRole('button', { name: '保存修改', exact: true }).isDisabled(),
    true,
  )
  assert.equal(
    await dialog.getByLabel('项目名称', { exact: true }).inputValue(),
    '冲突窗口里的修改',
  )
  await dialog.getByRole('button', { name: '重新加载项目', exact: true }).click()
  await page.waitForFunction(
    () => document.querySelector('#managed-project-name')?.value === '巴西售后业务',
  )
  await dialog.getByRole('checkbox', { name: '云售后', exact: true }).check()
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  results.push({ scenario: 'multiple-sources-edit-local-only-stale-reload', passed: true })
  await page.screenshot({ path: new URL('project-management.png', evidence).pathname })
  admin.setRunning(1)
  await page.getByRole('button', { name: '管理云售后', exact: true }).click()
  await page.getByRole('menuitem', { name: '清空项目内容', exact: true }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByText('本项目有正在运行的整理，请先停止整理，再刷新内容数量。').waitFor()
  await dialog.getByLabel('输入“云售后”确认清空').fill('云售后')
  assert.equal(
    await dialog.getByRole('button', { name: '确认清空项目内容', exact: true }).isDisabled(),
    true,
  )
  admin.setRunning(0)
  await dialog.getByRole('button', { name: '刷新数量', exact: true }).click()
  await dialog
    .getByRole('button', { name: '确认清空项目内容', exact: true })
    .waitFor({ state: 'visible' })
  await dialog.getByLabel('输入“云售后”确认清空').fill('错误项目')
  assert.equal(
    await dialog.getByRole('button', { name: '确认清空项目内容', exact: true }).isDisabled(),
    true,
  )
  await dialog.getByLabel('输入“云售后”确认清空').fill('云售后')
  await settle(page)
  await page.screenshot({ path: new URL('clear-project.png', evidence).pathname })
  await dialog.getByRole('button', { name: '确认清空项目内容', exact: true }).click()
  await dialog.getByRole('button', { name: '正在清空…', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  assert.equal(await dialog.isVisible(), true)
  assert.equal(
    await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).isDisabled(),
    true,
  )
  admin.finishFailure()
  await dialog.getByRole('alert').getByText('模拟清空失败，内容保持原状。').waitFor()
  assert.equal(await dialog.getByLabel('输入“云售后”确认清空').inputValue(), '云售后')
  await dialog.getByRole('button', { name: '确认清空项目内容', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  await page.getByRole('status').getByText('已清空“云售后”的内容，项目及配置已保留。').waitFor()
  assert.equal(admin.clearAttempts(), 2)
  results.push({ scenario: 'admin-create-clear-validation-busy-error-retry', passed: true })
  await admin.ctx.close()
  const revoked = await context('admin')
  revoked.revoke()
  await revoked.page.getByRole('button', { name: '创建项目', exact: true }).click()
  await revoked.page
    .getByRole('button', { name: '创建项目', exact: true })
    .waitFor({ state: 'hidden' })
  assert.equal(await revoked.page.getByRole('dialog').count(), 0)
  results.push({ scenario: 'revoked-capability', passed: true })
  await revoked.ctx.close()
  const mobile = await context('admin', true, { width: 390, height: 844 })
  await mobile.page.getByRole('button', { name: '创建项目', exact: true }).click()
  await mobile.page.getByRole('dialog').waitFor()
  await settle(mobile.page)
  await mobile.page.screenshot({ path: new URL('create-project-mobile.png', evidence).pathname })
  assert.equal(
    await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  )
  results.push({ scenario: 'mobile', passed: true })
  await mobile.ctx.close()
  assert.deepEqual(errors, [])
  await writeFile(
    new URL('result.json', evidence),
    JSON.stringify({ results, errors, calls }, null, 2),
  )
  console.log(JSON.stringify({ results, errors }, null, 2))
} finally {
  await browser.close()
}

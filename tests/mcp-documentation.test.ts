import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { mcpReference, mcpReferenceHtml } from '../build/mcpDocumentation'
import { mcpTools } from '../src/features/mcp-docs/content'
it('exposes the actual installation boundaries, scenario and tools without executing JavaScript', () => {
  const reference = mcpReference(process.cwd())
  const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  const html = mcpReferenceHtml(template, reference)
  expect(html).toContain('data-mcp-reference')
  expect(html).toContain('/settings/mcp')
  expect(html).toContain('网页登录 Token 仅用于管理凭证，不能用来连接 MCP')
  expect(html).toContain('创建技术咨询单')
  expect(html).toContain('source_record')
  expect(html).toContain('fields_has_more')
  expect(html).toContain('request_material_has_more')
  expect(html).toContain('href="/mcp.md"')
  expect(html).toContain('/src/main.ts')
  for (const tool of mcpTools) expect(html).toContain(tool.name)
})
it('keeps a deployment path prefix on static documentation links', () => {
  const html = mcpReferenceHtml(
    '<head></head><div id="app"></div>',
    '[资料](/mcp.md) [接入](/docs/mcp)',
    '/nexofolio/',
  )
  expect(html).toContain('href="/nexofolio/mcp.md"')
  expect(html).toContain('href="/nexofolio/docs/mcp"')
})
it('provides current-instance connection information without a hardcoded demo host', () => {
  const local = mcpReference(process.cwd(), {
    apiBase: '/api',
    pageUrl: 'http://127.0.0.1:5173/docs/mcp',
  })
  expect(local).toContain('http://127.0.0.1:5173/api/mcp')
  const production = mcpReference(process.cwd(), {
    apiBase: '/api',
    pageUrl: 'https://nexofolio.net/docs/mcp',
  })
  expect(production).toContain('https://nexofolio.net/api/mcp')
  expect(production.slice(0, 500)).toContain('https://nexofolio.net/api/mcp')
  expect(production).toContain('https://nexofolio.net/settings/mcp')
  expect(production).not.toContain('http://127.0.0.1:5173/docs/mcp')
  expect(production).not.toContain('your-nexofolio-instance')
  const staticReference = mcpReference(process.cwd(), {
    apiBase: '/nexofolio/api',
    appBase: '/nexofolio/',
  })
  expect(staticReference).toContain('[/nexofolio/api/mcp](/nexofolio/api/mcp)')
  expect(staticReference).toContain('[/nexofolio/settings/mcp](/nexofolio/settings/mcp)')
  expect(staticReference).not.toContain('nexofolio.invalid')
})

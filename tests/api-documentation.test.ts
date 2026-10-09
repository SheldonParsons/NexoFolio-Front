import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { apiReference } from '../build/apiReference'
import { documentReferenceHtml } from '../build/mcpDocumentation'
import { collectAgentLinks, collectAgentPrompt } from '@/features/collect-docs/agent'

it.each([
  ['http://127.0.0.1:5173/docs/api', 'http://127.0.0.1:5173'],
  ['https://nexofolio.net/docs/api', 'https://nexofolio.net'],
])('fills a directly usable developer brief for %s', (page, origin) => {
  const links = collectAgentLinks('/api', page)
  expect(links.endpoint).toBe(origin + '/api/v1/collect/batches')
  expect(links.documentUrl).toBe(origin + '/docs/api')
  expect(links.referenceUrl).toBe(origin + '/api.md')
  expect(links.contractUrl).toBe(origin + '/contracts/collect-1.1.0.zip')
  const prompt = collectAgentPrompt(links)
  for (const value of Object.values(links)) expect(prompt).toContain(value)
  expect(prompt).toContain('未经我明确要求，不发送真实录入请求')
  expect(prompt).not.toContain('your-nexofolio')
})
it('returns full field and recovery instructions in the initial HTML, without running JavaScript', () => {
  const reference = apiReference(process.cwd(), {
    apiBase: '/api',
    pageUrl: 'https://nexofolio.net/docs/api',
  })
  const html = documentReferenceHtml(
    readFileSync(resolve(process.cwd(), 'index.html'), 'utf8'),
    reference,
    '/',
    'api',
  )
  expect(reference.slice(0, 500)).toContain('https://nexofolio.net/api/v1/collect/batches')
  for (const text of [
    'data-api-reference',
    '给 Agent 的阅读与开发要求',
    'partial',
    'BATCH_ID_REUSED',
    'Retry-After',
    'rejected',
  ])
    expect(html).toContain(text)
  expect(html).toContain('href="/api.md"')
  expect(html).toContain('/src/main.ts')
  expect(html).not.toContain('http://127.0.0.1:5173/docs/api')
})
it('keeps deployment prefixes and an independent API origin correct', () => {
  const links = collectAgentLinks(
    'https://api.example.com/gateway',
    'https://example.com/app/docs/api',
    '/app/',
  )
  expect(links.endpoint).toBe('https://api.example.com/gateway/v1/collect/batches')
  expect(links.documentUrl).toBe('https://example.com/app/docs/api')
  const reference = apiReference(process.cwd(), { apiBase: '/gateway', appBase: '/app/' })
  expect(reference).toContain('[/gateway/v1/collect/batches](/gateway/v1/collect/batches)')
  expect(reference).toContain('[/app/api.md](/app/api.md)')
  expect(reference).not.toContain('nexofolio.invalid')
})

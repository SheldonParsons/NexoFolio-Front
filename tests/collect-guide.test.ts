import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectCurl,
  collectQuickExamples,
  collectServiceBase,
  prepareCollectExample,
} from '../src/features/collect-docs/guide'
import { checkBatch } from '../src/features/collect-docs/contract'

const body = readFileSync(
  fileURLToPath(new URL('../src/content/docs/api.md', import.meta.url)),
  'utf8',
)
afterEach(() => vi.unstubAllGlobals())
it('generates valid fresh collection examples without HTTP-only randomUUID support', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  for (const example of collectQuickExamples(body)) {
    const prepared = prepareCollectExample(example.text)
    expect(checkBatch(prepared).valid).toBe(true)
    expect(JSON.parse(prepared).batch_id).not.toBe(JSON.parse(example.text).batch_id)
    expect(JSON.parse(prepared).batch_id).not.toBe(JSON.parse(prepared).records[0].id)
  }
})
describe('guided collection examples', () => {
  it('loads both documented batch types, excluding receipts and errors', () => {
    const examples = collectQuickExamples(body)
    expect(examples.map((example) => example.kind)).toEqual(['http_exchange', 'http_declaration'])
    for (const example of examples) expect(checkBatch(example.text).valid).toBe(true)
  })
})
describe('collection command generation', () => {
  it('preserves deployment prefixes and uses a JSON file instead of inline shell interpolation', () => {
    const result = collectCurl(' https://example.com:8443/api/ ')
    expect(result.error).toBe('')
    expect(result.command).toContain("NEXOFOLIO_URL='https://example.com:8443/api'")
    expect(result.command).toContain('"$NEXOFOLIO_URL/v1/collect/batches"')
    expect(result.command).toContain('--data-binary @batch.json')
    expect(result.command).not.toContain('Authorization')
  })
  it.each([
    'ftp://example.com',
    'https://user:secret@example.com',
    'https://example.com?a=1',
    'https://example.com#test',
    'not-a-url',
    'https://example.com/v1/collect/batches',
  ])('rejects an inappropriate base address: %s', (value) => {
    expect(collectCurl(value).error).not.toBe('')
    expect(collectCurl(value).command).toBe('')
  })
  it('shell-quotes apostrophes rather than allowing the assignment to terminate', () => {
    expect(collectCurl("https://example.com/api/'quoted'").command).toContain(
      "/api/'\\''quoted'\\'''",
    )
  })
  it('does not invent a server URL when no address is configured', () => {
    expect(collectCurl('').command).toBe('')
    expect(collectCurl('').error).toContain('当前环境')
  })
  it.each([
    ['http://127.0.0.1:5173/docs/api', 'http://127.0.0.1:5173/api'],
    ['https://nexofolio.net/docs/api', 'https://nexofolio.net/api'],
  ])('fills the API gateway for %s', (page, base) => {
    expect(collectServiceBase('/api', page)).toBe(base)
    expect(collectCurl(collectServiceBase('/api', page)).command).toContain(base)
  })
  it('preserves a separately hosted API prefix', () => {
    expect(
      collectServiceBase('https://api.example.com/nexofolio/', 'https://example.com/docs/api'),
    ).toBe('https://api.example.com/nexofolio')
  })
})
it('generates fresh example identifiers and fills a selected project without changing the original fixture', () => {
  const source = collectQuickExamples(body)[0]!.text
  const original = JSON.parse(source)
  const ids = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
  const context = {
    projectId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    environmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  }
  const prepared = prepareCollectExample(
    source,
    context,
    () => ids.shift()!,
    '2026-10-09T00:00:00Z',
  )
  expect(checkBatch(prepared).valid).toBe(true)
  const value = JSON.parse(prepared)
  expect(value.batch_id).not.toBe(original.batch_id)
  expect(value.records[0].id).not.toBe(original.records[0].id)
  expect(value.target).toEqual({
    project_id: context.projectId,
    environment: { id: context.environmentId },
  })
  expect(value.records[0].observed_at).toBe('2026-10-09T00:00:00Z')
  expect(value.records[0].payload).toEqual(original.records[0].payload)
  expect(JSON.parse(source)).toEqual(original)
})

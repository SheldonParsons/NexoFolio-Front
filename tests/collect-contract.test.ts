import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import {
  checkBatch,
  invalidExamples,
  readablePath,
  unlabeledExamples,
  validExamples,
} from '../src/features/collect-docs/contract'
import manifest from '../src/contracts/collect/1.0.0/manifest.json'
import receiptSchema from '../src/contracts/collect/1.0.0/receipt.schema.json'
import errorSchema from '../src/contracts/collect/1.0.0/error.schema.json'

const contractDir = fileURLToPath(new URL('../src/contracts/collect/1.0.0/', import.meta.url))
const example = (name: string) =>
  [...validExamples, ...invalidExamples].find((item) => item.name === name)!

describe('collect contract bundle', () => {
  it('matches every hash pinned in the manifest', () => {
    for (const [file, hash] of Object.entries(manifest.files)) {
      const actual = createHash('sha256')
        .update(readFileSync(`${contractDir}${file}`))
        .digest('hex')
      expect(actual, file).toBe(hash)
    }
  })

  it('offers every fixture as a labelled example', () => {
    expect(validExamples).toHaveLength(4)
    expect(invalidExamples).toHaveLength(25)
    expect(unlabeledExamples).toEqual([])
  })

  it('accepts the valid fixtures and rejects the invalid ones with a reason', () => {
    for (const item of validExamples) {
      expect(checkBatch(item.text), item.name).toMatchObject({ valid: true, issues: [] })
    }
    for (const item of invalidExamples) {
      const result = checkBatch(item.text)
      expect(result.valid, item.name).toBe(false)
      expect(result.issues.length, item.name).toBeGreaterThan(0)
      for (const issue of result.issues) expect(issue.message, item.name).toMatch(/\p{Script=Han}/u)
    }
  })
})

describe('collect workbench messages', () => {
  it('points at the field that broke the contract', () => {
    expect(checkBatch(example('lowercase-method').text).issues).toContainEqual({
      path: 'records[0].payload.request.method',
      message: '应为大写的方法名，例如 GET',
    })
    expect(checkBatch(example('environment-name-with-surrounding-space').text).issues).toEqual([
      { path: 'target.environment.name', message: '首尾不能有空白，也不能包含控制字符' },
    ])
    expect(checkBatch(example('environment-with-id-and-name').text).issues).toEqual([
      { path: 'target.environment', message: '只能写 id 或 name 其中一个' },
    ])
    expect(checkBatch(example('declaration-bad-response-code').text).issues).toEqual([
      {
        path: 'records[1].payload.responses',
        message: '键名 ok 不合法，应为状态码、1XX 到 5XX 或 default',
      },
    ])
    expect(checkBatch(example('exchange-without-environment').text).issues).toEqual([
      { path: 'target', message: '批次里有调用记录，必须填写 environment' },
    ])
  })

  it('reports JSON syntax errors and sizes', () => {
    const broken = checkBatch('{"batch_id":')
    expect(broken).toMatchObject({ parsed: false, valid: false })
    expect(broken.issues[0]!.message).toMatch(/^不是合法的 JSON/)
    expect(checkBatch('"好"').bytes).toBe(5)
  })

  it('flags records over 4 MiB without failing the batch', () => {
    const batch = JSON.parse(example('swagger-declarations-without-environment').text)
    batch.records[0].payload.summary = 'x'.repeat(4 * 1024 * 1024)
    const result = checkBatch(JSON.stringify(batch))
    expect(result.oversizedRecords).toEqual([0])
  })

  it('renders JSON pointers as readable paths', () => {
    expect(readablePath('')).toBe('')
    expect(readablePath('/records/12/payload/responses/2XX')).toBe(
      'records[12].payload.responses.2XX',
    )
    expect(readablePath('/a~1b/c~0d')).toBe('a/b.c~d')
  })
})

describe('collect API page', () => {
  const page = readFileSync(
    fileURLToPath(new URL('../src/content/docs/api.md', import.meta.url)),
    'utf8',
  )
  const blocks = [...page.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => match[1]!)
  const ajv = new Ajv2020({ strict: true, allErrors: true })
  addFormats(ajv)
  const receipt = ajv.compile(receiptSchema)
  const error = ajv.compile(errorSchema)

  it('keeps the workbench marker', () => {
    expect(page).toContain('<!-- collect-workbench -->')
  })

  it('only shows examples that satisfy the contract', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(5)
    for (const block of blocks) {
      const value = JSON.parse(block) as Record<string, unknown>
      if ('records' in value) expect(checkBatch(block).issues, block).toEqual([])
      else if ('accepted' in value) expect(receipt(value), block).toBe(true)
      else if ('error' in value) expect(error(value), block).toBe(true)
      else throw new Error(`unrecognised example:\n${block}`)
    }
  })
})

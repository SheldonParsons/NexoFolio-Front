import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import batchSchema from '@/contracts/collect/1.0.0/batch.schema.json'
import manifest from '@/contracts/collect/1.0.0/manifest.json'

// The collect contract is copied byte-for-byte from the backend; this page only reads it.
// The schema adds `required` in `then` branches and `if` guards without `type`, which strict
// mode reports as style issues rather than errors.
const ajv = new Ajv2020({
  strict: true,
  strictTypes: false,
  strictRequired: false,
  allErrors: true,
})
addFormats(ajv)
const validateBatch = ajv.compile(batchSchema)

export const collectContract = {
  version: manifest.contract_version,
  batchBytes: manifest.limits.batch_bytes,
  recordBytes: manifest.limits.record_bytes,
  recordsPerBatch: manifest.limits.records_per_batch,
}

const rawFixtures = import.meta.glob<string>('@/contracts/collect/1.0.0/fixtures/batch/*/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const labels: Record<string, string> = {
  'fetcher-exchanges': '浏览器采集的两次调用',
  'exchange-without-context-or-response': '没有上下文和响应的调用',
  'swagger-declarations-without-environment': 'Swagger 同步的接口声明',
  'declaration-with-environment-name': '按环境名提交的声明',
  'missing-platform': '缺少 platform',
  'platform-with-spaces': 'platform 含有空格',
  'missing-target': '缺少 target',
  'exchange-without-environment': '调用记录没有指定环境',
  'environment-with-id-and-name': '环境同时写了 id 和 name',
  'environment-name-with-surrounding-space': '环境名首尾有空白',
  'site-origin-with-path': '站点 origin 带了路径',
  'empty-records': 'records 为空',
  'too-many-records': '超过 50 条记录',
  'unknown-kind': '未知的 kind',
  'unsupported-version': '不支持的记录版本',
  'unknown-record-field': '记录中有未知字段',
  'unknown-context-field': 'context 中有未知字段',
  'timestamp-without-timezone': '时间没有时区',
  'lowercase-method': '方法名是小写',
  'relative-request-url': '请求地址不是绝对地址',
  'header-entry-not-a-pair': '请求头不是名称、值对',
  'response-without-status': '响应缺少 status',
  'unknown-body-state': '未知的 body 状态',
  'full-body-without-content': 'full 状态缺少 content',
  'none-body-with-content': 'none 状态带了内容',
  'declaration-with-context': '声明记录带了 context',
  'declaration-with-exchange-payload': '声明记录用了调用记录的内容',
  'declaration-path-with-query': '声明路径带了查询参数',
  'declaration-bad-response-code': '声明的响应键不是状态码',
}

export interface CollectExample {
  name: string
  label: string
  expected: 'valid' | 'invalid'
  text: string
}

function examples(expected: CollectExample['expected']) {
  const order = Object.keys(labels)
  return Object.entries(rawFixtures)
    .map(([path, text]) => {
      const [, outcome = '', name = ''] = /\/(valid|invalid)\/([^/]+)\.json$/.exec(path) ?? []
      return { name, label: labels[name] ?? name, expected: outcome, text }
    })
    .filter((example): example is CollectExample => example.expected === expected)
    .sort((a, b) => rank(order, a.name) - rank(order, b.name))
}
function rank(order: string[], name: string) {
  const index = order.indexOf(name)
  return index < 0 ? order.length : index
}

export const validExamples = examples('valid')
export const invalidExamples = examples('invalid')
export const unlabeledExamples = [...validExamples, ...invalidExamples]
  .filter((example) => !(example.name in labels))
  .map((example) => example.name)

export interface CollectIssue {
  path: string
  message: string
}
export interface CollectCheck {
  parsed: boolean
  valid: boolean
  issues: CollectIssue[]
  bytes: number
  records: { exchanges: number; declarations: number }
  oversizedRecords: number[]
}

const encoder = new TextEncoder()

export function checkBatch(text: string): CollectCheck {
  const bytes = encoder.encode(text).length
  const empty = { exchanges: 0, declarations: 0 }
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    return {
      parsed: false,
      valid: false,
      issues: [{ path: '', message: `不是合法的 JSON。${detail}` }],
      bytes,
      records: empty,
      oversizedRecords: [],
    }
  }
  const valid = validateBatch(value)
  const records = isRecordList(value) ? value.records : []
  const issues = valid ? [] : describe(validateBatch.errors ?? [])
  if (bytes > collectContract.batchBytes) {
    issues.push({ path: '', message: '请求体超过 8 MiB，服务端会整批返回 413。' })
  }
  const oversizedRecords = records
    .map((record, index) => ({ index, size: encoder.encode(JSON.stringify(record)).length }))
    .filter((record) => record.size > collectContract.recordBytes)
    .map((record) => record.index)
  return {
    parsed: true,
    valid: valid && bytes <= collectContract.batchBytes,
    issues,
    bytes,
    records: {
      exchanges: records.filter((record) => kindOf(record) === 'http_exchange').length,
      declarations: records.filter((record) => kindOf(record) === 'http_declaration').length,
    },
    oversizedRecords,
  }
}

function isRecordList(value: unknown): value is { records: unknown[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { records?: unknown }).records)
  )
}
function kindOf(record: unknown) {
  return typeof record === 'object' && record !== null
    ? (record as { kind?: unknown }).kind
    : undefined
}

/** `/records/0/payload/request` → `records[0].payload.request` */
export function readablePath(pointer: string) {
  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce(
      (path, part) => (/^\d+$/.test(part) ? `${path}[${part}]` : path ? `${path}.${part}` : part),
      '',
    )
}

const typeNames: Record<string, string> = {
  object: '对象',
  array: '数组',
  string: '字符串',
  integer: '整数',
  number: '数字',
  boolean: '布尔值',
  null: 'null',
}

function describe(errors: ErrorObject[]): CollectIssue[] {
  const seen = new Set<string>()
  const issues: CollectIssue[] = []
  const add = (error: ErrorObject) => {
    const message = explain(error)
    const path = readablePath(error.instancePath)
    const key = `${path}\n${message}`
    if (seen.has(key)) return
    seen.add(key)
    issues.push({ path, message })
  }
  for (const error of errors) {
    // `if` only explains why a `then` branch applied; the `propertyNames` error already
    // names the bad key that its inner pattern error describes.
    if (error.keyword === 'if' || /\/(oneOf|propertyNames)\//.test(error.schemaPath)) continue
    if (error.keyword !== 'oneOf') {
      add(error)
      continue
    }
    // When the value picked a branch but broke a field inside it (e.g. a bad environment
    // name), that field is the useful message; otherwise the value matched no shape at all.
    const deeper = errors.filter(
      (branch) =>
        branch.schemaPath.startsWith(`${error.schemaPath}/`) &&
        branch.instancePath.length > error.instancePath.length,
    )
    if (deeper.length > 0) deeper.forEach(add)
    else add(error)
  }
  return issues
}

function explain(error: ErrorObject): string {
  const params = error.params as Record<string, unknown>
  const field = error.instancePath.split('/').pop() ?? ''
  switch (error.keyword) {
    case 'required':
      if (error.schemaPath.startsWith('#/then/') && params.missingProperty === 'environment') {
        return '批次里有调用记录，必须填写 environment'
      }
      return `缺少字段 ${String(params.missingProperty)}`
    case 'additionalProperties':
      return `不允许出现字段 ${String(params.additionalProperty)}`
    case 'enum':
      return `只能是 ${(params.allowedValues as unknown[]).map((v) => JSON.stringify(v)).join('、')}`
    case 'const':
      return `只能是 ${JSON.stringify(params.allowedValue)}`
    case 'type':
      return `应为${typeNames[String(params.type)] ?? String(params.type)}`
    case 'minItems':
      return `至少需要 ${String(params.limit)} 项`
    case 'maxItems':
      return `最多 ${String(params.limit)} 项`
    case 'minLength':
      return `至少 ${String(params.limit)} 个字符`
    case 'maxLength':
      return `最多 ${String(params.limit)} 个字符`
    case 'minimum':
      return `不能小于 ${String(params.limit)}`
    case 'maximum':
      return `不能大于 ${String(params.limit)}`
    case 'format':
      return params.format === 'date-time'
        ? '应为带时区的 RFC 3339 时间'
        : `应为 ${String(params.format)} 格式`
    case 'propertyNames':
      return `键名 ${String(params.propertyName)} 不合法，应为状态码、1XX 到 5XX 或 default`
    case 'oneOf':
      if (field === 'environment') return '只能写 id 或 name 其中一个'
      if (field === 'site') return '应为 null 或 { origin, prefix }'
      return '不符合任何一种允许的写法'
    case 'pattern':
      return patternHint(field, String(params.pattern))
    default:
      return error.message ?? '不符合合同'
  }
}

function patternHint(field: string, pattern: string) {
  if (pattern.startsWith('^[0-9a-fA-F]{8}')) return '应为 UUID'
  if (pattern.startsWith('^\\d{4}')) return '应为带时区的 RFC 3339 时间'
  const hints: Record<string, string> = {
    platform: '只能用小写字母、数字、.、_、-，以字母或数字开头，最多 64 个字符',
    method: '应为大写的方法名，例如 GET',
    url: '应为 http 或 https 开头的绝对地址',
    origin: '只能包含协议和主机，例如 https://shop.example.com',
    prefix: '应以 / 开头，不能包含 ?、# 或空白',
    path: '应以 / 开头，不能包含 ?、# 或空白',
    name: '首尾不能有空白，也不能包含控制字符',
  }
  return hints[field] ?? `不符合格式 ${pattern}`
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

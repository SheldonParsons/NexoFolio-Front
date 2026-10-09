export const collectDocHeadings = [
  { id: 'api-agent', title: '交给 Agent 开发', level: 2 },
  { id: 'api-overview', title: '先选接入方式', level: 2 },
  { id: 'api-quickstart', title: '跟着示例走一遍', level: 2 },
  { id: 'api-fields', title: '字段怎么填', level: 2 },
  { id: 'api-errors', title: '失败后怎么办', level: 2 },
  { id: 'api-limits', title: '限制与规范下载', level: 2 },
]

export function splitCollectSections(body: string) {
  return body
    .split(/(?=^## )/m)
    .filter((section) => section.trim())
    .map((section) => {
      const title = /^## (.+)$/m.exec(section)?.[1] ?? ''
      return { title, body: section.replace(/^## .+\n/, '').trim() }
    })
}

export function collectQuickExamples(body: string) {
  return [...body.matchAll(/```json\n([\s\S]*?)```/g)].flatMap((match) => {
    const text = match[1]!.trim()
    const value = JSON.parse(text) as { records?: { kind?: string }[] }
    if (!value.records) return []
    return [{ kind: value.records[0]?.kind ?? '', text: JSON.stringify(value, null, 2) }]
  })
}

export function collectCurl(base: string): { command: string; error: string } {
  let address = base.trim()
  if (!address) return { command: '', error: '请填写服务基础地址，或使用当前环境地址。' }
  try {
    const url = new URL(address)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return {
        command: '',
        error: '请填写 HTTP(S) 服务基础地址，不包含账号、密码、查询参数或 # 片段。',
      }
    if (/\/v1\/collect\/batches\/?$/.test(url.pathname))
      return { command: '', error: '这里只填服务基础地址，不需要添加 /v1/collect/batches。' }
    address = url.href.replace(/\/+$/, '')
  } catch {
    return { command: '', error: '请输入完整的 HTTP(S) 服务基础地址。' }
  }
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"
  return {
    command: `NEXOFOLIO_URL=${quote(address)}\n\ncurl -X POST "$NEXOFOLIO_URL/v1/collect/batches" \\\n  -H 'Content-Type: application/json' \\\n  --data-binary @batch.json`,
    error: '',
  }
}

export function collectServiceBase(apiBase: string, pageUrl: string): string {
  try {
    const address = new URL(apiBase, new URL(pageUrl).origin).href.replace(/\/+$/, '')
    return collectCurl(address).error ? '' : address
  } catch {
    return ''
  }
}

/** Prepare only documentation examples; no network request is made. */
export function prepareCollectExample(
  text: string,
  context: { projectId?: string; environmentId?: string } = {},
  createId: () => string = () => crypto.randomUUID(),
  observedAt = new Date().toISOString(),
): string {
  const value = JSON.parse(text) as {
    batch_id: string
    target: Record<string, unknown>
    records: { id: string; observed_at: string }[]
  }
  value.batch_id = createId()
  for (const record of value.records) {
    record.id = createId()
    record.observed_at = observedAt
  }
  if (context.projectId) {
    value.target.project_id = context.projectId
    if (context.environmentId) value.target.environment = { id: context.environmentId }
  }
  return JSON.stringify(value, null, 2)
}

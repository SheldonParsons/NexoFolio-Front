import MarkdownIt from 'markdown-it'
import type { InterfaceReport } from './interfaceReport'
import { schemaRows, schemaType } from './schemaPresentation'
import { limitationText } from './presentation'

const renderer = new MarkdownIt({ html: false, linkify: false, typographer: false })
renderer.renderer.rules.table_open = () => '<div class="interface-markdown-table"><table>'
renderer.renderer.rules.table_close = () => '</table></div>'
// Report strings are data, never executable HTML or remote image sources.
function text(value: unknown): string {
  const raw = typeof value === 'string' ? value : JSON.stringify(value) ?? '—'
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|~\-]/g, '\\$&').replace(/\r?\n/g, ' ')
}
function json(value: unknown): string {
  const raw = JSON.stringify(value, null, 2) ?? 'null'
  const longest = Math.max(2, ...(raw.match(/~+/g) ?? []).map(run => run.length))
  const fence = '~'.repeat(longest + 1)
  return `${fence}json\n${raw}\n${fence}`
}
function table(rows: [string, unknown][]) {
  return ['| 信息 | 内容 |', '| --- | --- |', ...rows.map(([key, value]) => `| ${text(key)} | ${text(value)} |`)].join('\n')
}
function schema(value: unknown) {
  const result = schemaRows(value)
  return [
    '| 字段路径 | 观测类型 | 说明 |', '| --- | --- | --- |',
    ...result.rows.map(row => `| ${text(row.path)} | ${text(row.type)} | ${text(row.note || '—')} |`),
    result.truncated ? '\n字段概览较长，仅展示前部；完整结构见下方 JSON。' : '',
    '\n完整结构：\n', json(value),
  ].join('\n')
}
function fields(items: { name: string; observed_schema: Record<string, unknown> }[]) {
  if (!items.length) return '未记录字段。'
  return ['| 名称 | 观测类型 |', '| --- | --- |', ...items.map(item => `| ${text(item.name)} | ${text(schemaType(item.observed_schema))} |`), '', json(items)].join('\n')
}
export function interfaceReportMarkdown(report: InterfaceReport) {
  const { selection } = report
  const { item, catalog } = selection
  const directory = catalog.nodes.find(node => node.id === selection.directoryId)
  const chunks = [
    `# ${text(item.method)} ${text(item.path)}`,
    table([
      ['接口 ID', item.id], ['项目 ID', catalog.projectId], ['目录', directory?.name ?? selection.directoryId],
      ['目录说明', directory?.description || '—'], ['目录版本', catalog.versionId ?? '初始目录'],
      ['目录代次', catalog.generation], ['来源任务', catalog.sourceTaskId ?? '—'], ['来源维护任务', catalog.sourceRunId ?? '—'],
      ['展示环境', report.environments.map(env => env.name).join('、') || '无'],
    ]),
    '## 目录归属与展示合并关系',
    json({ directory, groups: catalog.groups.filter(group => group.representative_id === item.id || group.member_ids.includes(item.id)), interface: item }),
  ]
  for (const env of report.environments) {
    chunks.push(`## 环境：${text(env.name)}`, `环境 ID：${text(env.id)}`)
    if (env.errors.length) chunks.push('### 未能完整读取的资料', ...env.errors.map(error => `- ${text(error)}`))
    if (env.definition) {
      const { definition, ...metadata } = env.definition
      chunks.push('### 接口基本信息', table(Object.entries(metadata)), '完整元数据：', json(metadata))
      chunks.push('### 请求', '#### Path 参数', fields(definition.request.parameters.filter(field => field.in === 'path')),
        '#### Query 参数', fields(definition.request.parameters.filter(field => field.in === 'query')),
        '#### 请求头', fields(definition.request.headers), '#### 请求正文', json(definition.request.body))
      if ('observed_schema' in definition.request.body && definition.request.body.observed_schema) chunks.push('#### 请求字段结构', schema(definition.request.body.observed_schema))
      chunks.push('### 响应', table([['HTTP 状态', definition.response.status], ['采集状态', definition.response.capture_state]]),
        '#### 响应头', fields(definition.response.headers), '#### 响应正文', json(definition.response.body))
      if ('observed_schema' in definition.response.body && definition.response.body.observed_schema) chunks.push('#### 响应字段结构', schema(definition.response.body.observed_schema))
      chunks.push('### 提取规则与观测限制', `提取器：${text(definition.extractor_version)}`,
        definition.limitations.length ? definition.limitations.map(code => `- ${text(limitationText(code))}（${text(code)}）`).join('\n') : '未提供额外限制说明。')
    } else chunks.push('### 接口定义', '尚未读取成功。')
    chunks.push('### 已发布的衍生知识')
    if (env.knowledge) {
      const { annotations, ...version } = env.knowledge
      chunks.push(table(Object.entries(version)))
      if (!annotations.length) chunks.push('当前没有已发布的语义标注。')
      for (const entry of annotations) {
        const annotation = entry.annotation
        const names = { description: '说明', enum: '枚举与标签', parameter_relation: '参数关联' }
        const status = { observed: '观测所得', inferred: '推断', needs_review: '待复核' }
        chunks.push(`#### ${names[annotation.value.kind]} · ${status[annotation.verification]}`)
        if (entry.stale) chunks.push('> 基础定义已变化，该标注已过期，需重新确认。')
        if (annotation.value.kind === 'description') chunks.push(text(annotation.value.text))
        if (annotation.note) chunks.push(text(annotation.note))
        chunks.push(json(entry))
      }
    } else chunks.push('尚未读取成功，不代表没有衍生知识。')
    chunks.push('### 结构判定、补全与差异')
    if (env.assessments) {
      chunks.push(`共 ${env.assessments.length} 条判定记录。`)
      for (const assessment of env.assessments) chunks.push(`#### 观测 ${text(assessment.ingestion_id)}`,
        assessment.assessment ? `判定：${text(assessment.assessment.categories.join('、'))}；规则：${text(assessment.assessment.rule_version)}` : '历史记录未按当前规则判定，不能视为重复。', json(assessment))
    } else chunks.push('尚未读取成功。')
    chunks.push('### 采集历史与原始请求／响应')
    if (env.observationSummaries) chunks.push('采集处理时间、结果与修订引用：', json(env.observationSummaries))
    if (env.observations) {
      chunks.push(`已读取 ${env.observations.length} 条记录。`)
      for (const observation of env.observations) chunks.push(`#### 采集 ${text(observation.ingestion_id)}`, json(observation))
    } else chunks.push('尚未读取成功。')
    chunks.push('### 衍生证据：字段取值、枚举、关系与上下文')
    if (env.facts) {
      chunks.push(`共 ${env.facts.length} 条关联证据。仅按结构化字段引用或语义标注的明确引用关联；同页、同环境不代表接口归属。`)
      for (const fact of env.facts) chunks.push(`#### ${text(fact.kind)}`, json(fact))
    } else chunks.push('尚未读取成功。')
    chunks.push('### 证据原始样本')
    if (env.samples) {
      if (!env.samples.length) chunks.push('没有已关联的原始样本。')
      for (const sample of env.samples) chunks.push(`#### ${text(sample.kind)} · ${text(sample.captured_at)}`,
        sample.payload_available ? '' : '> 原始载荷不可用，以下保留服务返回的元数据。', json(sample))
    } else chunks.push('尚未读取成功。')
  }
  chunks.push('## 未发布的候选资料', '以下候选独立于已发布知识；任务与快照 ID 明确标注，项目级审阅意见不代表本接口已通过审阅。')
  if (report.candidates) {
    if (!report.candidates.length) chunks.push('当前未找到包含该接口的未发布候选。')
    report.candidates.forEach((candidate, index) => chunks.push(`### 候选 ${index + 1}`, json(candidate)))
  } else chunks.push('尚未读取成功。')
  if (report.errors.length) chunks.push('## 读取问题', ...report.errors.map(error => `- ${text(error)}`))
  return chunks.filter(Boolean).join('\n\n')
}
export function renderInterfaceReport(report: InterfaceReport) {
  return renderer.render(interfaceReportMarkdown(report))
}

export interface InterfaceReportBlock {
  id: string
  title: string
  html: string
  collapsible: boolean
  defaultOpen: boolean
}

/** Split Markdown tokens rather than HTML or lines, so headings inside JSON stay data. */
export function renderInterfaceReportBlocks(report: InterfaceReport): InterfaceReportBlock[] {
  const tokens = renderer.parse(interfaceReportMarkdown(report), {})
  const blocks: InterfaceReportBlock[] = []
  let body: typeof tokens = []
  let block: Omit<InterfaceReportBlock, 'html'> = {
    id: 'title', title: '', collapsible: false, defaultOpen: false,
  }
  let environment: string | null = null
  let environmentIndex = 0
  const flush = () => {
    if (body.length || block.collapsible) blocks.push({ ...block, html: renderer.renderer.render(body, renderer.options, {}) })
    body = []
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!
    if (token.type === 'heading_close' && token.tag === 'h1') {
      body.push(token)
      flush()
      block = { id: 'overview', title: '接口基本信息', collapsible: true, defaultOpen: true }
      continue
    }
    if (token.type === 'heading_open' && (token.tag === 'h2' || (token.tag === 'h3' && environment))) {
      flush()
      const inline = tokens[index + 1]!
      const title = inline.children?.map(child => child.content).join('') ?? inline.content
      if (token.tag === 'h2' && title.startsWith('环境：')) {
        environment = report.environments[environmentIndex++]?.id ?? title
        block = { id: `environment:${environment}`, title, collapsible: false, defaultOpen: false }
        body.push(token, inline, tokens[index + 2]!)
      } else {
        if (token.tag === 'h2') environment = null
        block = {
          id: `${environment ?? 'report'}:${title}`,
          title,
          collapsible: true,
          defaultOpen: title === '接口基本信息',
        }
      }
      index += 2
      continue
    }
    body.push(token)
  }
  flush()
  return blocks
}

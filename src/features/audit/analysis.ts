import { api, ApiError } from '@/api'
export type AccessKind = 'page' | 'api' | 'mcp'
export interface AccessRow {
  kind?: AccessKind
  project?: string
  resource?: string
  route?: string
  action?: string
  method?: string
  hits?: number
  users?: number
  visitor_ips?: number
  unknown_visits?: number
  last_at?: string
  at?: string
  actor?: string
  status?: number
  code?: string
  request_id?: string
  duration_ms?: number
}
export interface AccessReport {
  items: AccessRow[]
  total: number
  matching_visits?: number
  page: number
  limit: number
  actors?: Record<string, string>
  projects?: Record<string, string>
  resources?: Record<string, string>
  coverage: {
    detail_recording_started_at?: string
    retained_from?: string | null
    retained_until?: string | null
    stored_details?: number
    capacity_evictions?: number
  }
  health?: {
    enabled?: boolean
    dropped_access?: number
    dropped_important?: number
    storage_failures?: number
  }
  retention?: { days?: number; max_details?: number }
}
export const accessKinds = [
  { value: 'page', label: '页面访问' },
  { value: 'api', label: 'NexoFolio 后台 API' },
  { value: 'mcp', label: 'MCP 读取' },
]
export const ranges = [
  { value: '1', label: '最近 24 小时' },
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
  { value: '90', label: '最近 90 天' },
]
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
const count = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : undefined
const invalid = () => new ApiError('访问记录格式不完整，请刷新。', 'invalid-response')
const names = (value: unknown) =>
  record(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined
function accessRow(value: unknown): AccessRow {
  if (!record(value)) throw invalid()
  return {
    kind: ['page', 'api', 'mcp'].includes(String(value.kind))
      ? (value.kind as AccessKind)
      : undefined,
    project: text(value.project),
    resource: text(value.resource),
    route: text(value.route),
    action: text(value.action),
    method: text(value.method),
    hits: count(value.hits),
    users: count(value.users),
    visitor_ips: count(value.visitor_ips),
    unknown_visits: count(value.unknown_visits),
    last_at: text(value.last_at),
    at: text(value.at),
    actor: text(value.actor),
    status: count(value.status),
    code: text(value.code),
    request_id: text(value.request_id),
    duration_ms: count(value.duration_ms),
  }
}
export async function accessReport(
  params: URLSearchParams,
  signal: AbortSignal,
  request = api.request,
): Promise<AccessReport> {
  const result = await request<unknown>(`v1/audit/access?${params}`, { signal })
  if (
    !record(result) ||
    !Array.isArray(result.items) ||
    count(result.total) === undefined ||
    !count(result.page) ||
    !count(result.limit) ||
    result.items.length > (result.limit as number) ||
    result.items.length > (result.total as number)
  )
    throw invalid()
  const coverage = record(result.coverage) ? result.coverage : {},
    health = record(result.health) ? result.health : undefined,
    retention = record(result.retention) ? result.retention : undefined
  return {
    items: result.items.map(accessRow),
    total: result.total as number,
    page: result.page as number,
    limit: result.limit as number,
    matching_visits: count(result.matching_visits),
    actors: names(result.actors),
    projects: names(result.projects),
    resources: names(result.resources),
    coverage: {
      detail_recording_started_at: text(coverage.detail_recording_started_at),
      retained_from: text(coverage.retained_from),
      retained_until: text(coverage.retained_until),
      stored_details: count(coverage.stored_details),
      capacity_evictions: count(coverage.capacity_evictions),
    },
    health: health
      ? {
          enabled: typeof health.enabled === 'boolean' ? health.enabled : undefined,
          dropped_access: count(health.dropped_access),
          dropped_important: count(health.dropped_important),
          storage_failures: count(health.storage_failures),
        }
      : undefined,
    retention: retention
      ? { days: count(retention.days), max_details: count(retention.max_details) }
      : undefined,
  }
}
export function canInspectAccess(row: AccessRow) {
  return (
    !!row.kind &&
    ['project', 'resource', 'route', 'action', 'method'].every(
      (key) => typeof row[key as keyof AccessRow] === 'string',
    ) &&
    !!row.route &&
    !!row.method
  )
}
export function accessProjectName(row: AccessRow, report?: AccessReport | null) {
  return row.project === undefined
    ? '项目未记录'
    : row.project
      ? report?.projects?.[row.project] || '项目名称未记录'
      : '全站'
}
export const pageGroups = [
  { value: 'all', label: '全部页面' },
  { value: 'home', label: '首页' },
  { value: 'projects', label: '项目页' },
  { value: 'docs', label: '文档页' },
]
export function pageCategory(route: string) {
  if (route === 'home') return '首页'
  if (['projects', 'project-interfaces'].includes(route)) return '项目页'
  if (
    ['document-folder', 'document-endpoint', 'product-docs'].includes(route) ||
    route.startsWith('product-docs:')
  )
    return '文档页'
  return '其他页面'
}
const pageNames: Record<string, string> = {
  home: '首页',
  projects: '项目空间',
  'project-interfaces': '项目文档',
  'document-endpoint': '业务接口文档',
  'document-folder': '文档目录',
  'curation-review': '整理结果',
  'product-docs': '产品文档',
  'product-docs:mcp': 'MCP 使用指南',
  'product-docs:api': 'API 使用指南',
  'product-docs:fetcher': '采集器使用指南',
  'product-docs:philosophy': '认识 NexoFolio',
  'product-docs:retirement': '废弃与撤销废弃指南',
  'product-docs:unknown': '未识别的产品文档',
  'product-changelog': '更新日志',
  'mcp-credentials': 'MCP 凭证',
  settings: '工作区设置',
  'not-found': '未找到的页面',
}
const toolNames: Record<string, string> = {
  list_projects: '查找项目',
  list_environments: '查看环境',
  list_project_environments: '查看项目环境',
  read_request_material: '读取请求资料',
  read_response_material: '读取响应资料',
  read_field_values: '读取字段观测值',
  browse_directory: '浏览目录',
  search_interfaces: '搜索接口',
  read_interface: '读取接口',
  read_field: '读取字段',
  read_source_evidence: '读取来源证据',
  trace_dependencies: '追踪输入依赖',
  inspect_knowledge_coverage: '检查知识覆盖',
  read_relations: '读取关联',
  read_project: '读取项目',
  read_directory: '读取目录',
}
export function accessTitle(row: AccessRow, report?: AccessReport | null) {
  const route = row.route || '',
    action = row.action || ''
  let label =
    row.kind === 'page'
      ? pageNames[route] || '页面名称未记录'
      : row.kind === 'mcp'
        ? toolNames[action] || (action ? `MCP ${action}` : 'MCP 操作未记录')
        : row.kind === 'api'
          ? route
            ? apiTitle(route, row.method || '')
            : '后台接口名称未记录'
          : '访问类型未记录'
  if (row.resource) label += ` · ${report?.resources?.[row.resource] || '资源名称未记录'}`
  return label
}
function apiTitle(route: string, method: string) {
  if (!method) return '后台接口访问（方式未记录）'
  const read = !method ? '访问' : method === 'GET' ? '读取' : '更新'
  if (route === '/v1/auth/me') return '会话校验（不是登录次数）'
  if (route === '/v1/auth/login') return '登录请求'
  if (route === '/v1/sites/lookup') return '站点匹配查询（触发来源未记录）'
  if (route === '/v1/downloads') return '版本元数据查询（不是下载次数）'
  if (route.startsWith('/v1/downloads/')) return '下载安装包跳转请求'
  if (route.includes('/curate')) {
    if (method === 'GET')
      return route.endsWith('/candidates')
        ? '整理候选列表查询'
        : route.endsWith('/curate')
          ? '整理进度查询'
          : '读取整理结果'
    if (route.endsWith('/apply')) return '请求应用整理结果'
    if (route.endsWith('/resume')) return '请求续跑整理'
    if (route.endsWith('/cancel')) return '请求停止整理'
    if (route.endsWith('/discard')) return '请求放弃整理结果'
    return '请求开始整理（不代表成功轮次）'
  }
  if (route.includes('/endpoints/')) return `${read}业务接口资料`
  if (route.endsWith('/endpoints')) return '读取业务接口目录'
  if (route.includes('/knowledge')) return `${read}项目知识`
  if (route.includes('/environments')) return `${read}环境配置`
  if (route.includes('/projects')) return `${read}项目信息`
  if (route.includes('/auth')) return '登录与身份验证'
  if (route === '/mcp') return 'MCP 传输请求（不是工具调用次数）'
  return `${method || '方式未记录'} 后台接口调用`
}
export const auditTime = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString('zh-CN', { hour12: false })
    : '未记录'
export function actorName(row: AccessRow, report?: AccessReport | null) {
  const actor = row.actor || ''
  return (
    report?.actors?.[actor] ||
    (actor.startsWith('ip:')
      ? `访客 IP ${actor.slice(3)}`
      : actor.startsWith('user:')
        ? '已登录用户（姓名未记录）'
        : '未知访问身份')
  )
}

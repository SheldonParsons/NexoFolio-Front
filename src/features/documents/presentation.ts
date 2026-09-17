export const outcomeLabels = {
  created: '建立观测基线',
  unchanged: '结构未变',
  difference_recorded: '待处理差异',
} as const
export const processingLabels = {
  pending: '等待处理',
  processing: '处理中',
  completed: '处理完成',
  failed: '处理失败',
} as const
export const captureLabels: Record<string, string> = {
  none: '未携带正文',
  complete: '采集完成',
  truncated: '采集截断',
  unreadable: '无法读取',
  failed: '采集失败',
  timeout: '采集超时',
  'page-visible': '页面可见范围',
}
export function formatTime(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
    : value
}
export function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`
}
export function limitationText(code: string) {
  const known: Record<string, string> = {
    OBSERVED_ONLY_NOT_A_CONFIRMED_CONTRACT: '定义来自调用观测，尚未经业务确认。',
    NULL_DOES_NOT_ESTABLISH_FIELD_TYPE: '观测到 null，不能据此确定字段类型。',
    EMPTY_ARRAY_ITEM_TYPE_UNKNOWN: '观测到空数组，元素类型尚不明确。',
    STRUCTURE_EXTRACTION_LIMIT: '结构提取达到节点或深度限制，部分结构未知。',
    REQUEST_URL_TRUNCATED: '请求 URL 被截断，参数信息可能不完整。',
  }
  if (known[code]) return known[code]
  const side = code.startsWith('REQUEST_') ? '请求' : code.startsWith('RESPONSE_') ? '响应' : ''
  if (side && code.endsWith('_JSON_UNREADABLE')) return `${side} JSON 无法解析，未生成正文结构。`
  if (side && code.endsWith('_NON_JSON_BODY_NOT_STRUCTURALLY_INFERRED'))
    return `${side}正文不是 JSON，未推断结构。`
  if (side && code.includes('_HEADERS_')) return `${side}头仅包含已采集到的信息。`
  if (side && code.includes('_BODY_')) return `${side}正文采集不完整，结构可能缺失。`
  return code
}

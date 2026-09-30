import type { FieldFacts, FieldLocation } from '@/contracts/knowledge/types'

const LOCATION_LABELS: Record<string, string> = {
  path: '路径参数',
  query: '查询参数',
  request_body: '请求体',
  response_body: '响应体',
}

export function locationLabel(location: FieldLocation): string {
  const base = LOCATION_LABELS[location.in] ?? location.in
  return location.in === 'response_body' ? `${base} ${location.status}` : base
}

/** `data.list[].sku` — the same rendering the Rust side uses, so the two agree. */
export function fieldPath(path: FieldFacts['path']): string {
  let out = ''
  for (const segment of path) {
    if (segment === 'items' || (typeof segment === 'object' && 'items' in segment)) {
      out += '[]'
      continue
    }
    const key = typeof segment === 'string' ? segment : segment.key
    out += out ? `.${key}` : key
  }
  return out || '（整个报文）'
}

/** Groups by location so the panel can show 请求体 and 响应体 as separate blocks. */
export function groupFields(fields: FieldFacts[]) {
  const groups = new Map<string, { label: string; fields: FieldFacts[] }>()
  for (const field of fields) {
    const label = locationLabel(field.location)
    const group = groups.get(label)
    if (group) group.fields.push(field)
    else groups.set(label, { label, fields: [field] })
  }
  return [...groups.values()]
}

export function typeList(types: string[]): string {
  return types.length ? types.join(' | ') : '未知'
}

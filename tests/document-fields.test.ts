import { describe, expect, it } from 'vitest'
import { fieldPath, groupFields, locationLabel } from '@/features/knowledge/fieldPresentation'
import { fieldKey, fieldTree } from '@/features/documents/fieldTree'

describe('field presentation', () => {
  it('names each location, with the status of a response body', () => {
    expect(locationLabel({ in: 'query' })).toBe('查询参数')
    expect(locationLabel({ in: 'response_body', status: 200 })).toBe('响应体 200')
  })

  it('renders a field path the way the Rust side does', () => {
    expect(fieldPath(['data', 'list', 'items', 'sku'])).toBe('data.list[].sku')
    expect(fieldPath([])).toBe('（整个报文）')
  })

  it('groups fields by location, keeping first-seen order', () => {
    const groups = groupFields([
      { location: { in: 'query' }, path: ['page'] },
      { location: { in: 'response_body', status: 200 }, path: ['total'] },
      { location: { in: 'query' }, path: ['size'] },
    ] as never)
    expect(groups.map((group) => [group.label, group.fields.length])).toEqual([
      ['查询参数', 2],
      ['响应体 200', 1],
    ])
  })

  it('keeps nested arrays under their object and selects the location-specific note', () => {
    const field = (path: unknown[], location = { in: 'response_body', status: 200 }) => ({
      path,
      location,
      types: [],
      labels: [],
    })
    const fields = [
      field(['data']),
      field(['data', 'columns']),
      field(['data', 'columns', 'items']),
      field(['data', 'columns', 'items', 'code']),
    ] as never
    const notes = [
      { path: 'request_body:data.columns[].code', text: '请求字段' },
      { path: 'response_body:200:data.columns[].code', text: '列编码' },
    ] as never
    const roots = fieldTree(fields, notes)
    expect(roots).toHaveLength(1)
    expect(roots[0]!.children[0]!.children[0]!.children[0]!.note?.text).toBe('列编码')
    expect(roots[0]!.children[0]!.children[0]!.name).toBe('每个元素')
    expect(fieldKey(field(['data'], { in: 'request_body', status: 0 }) as never)).toBe(
      'request_body:data',
    )
  })
})

import { describe, expect, it } from 'vitest'
import { UNPLACED, flatten } from '@/features/knowledge/catalogTree'
import type { Catalog, EndpointCard } from '@/contracts/knowledge/types'
import { fieldPath, groupFields, locationLabel } from '@/features/knowledge/fieldPresentation'

function folder(id: string, parent: string | null, position: number, deep = 0) {
  return {
    id,
    parent,
    name: id,
    summary: null,
    position,
    endpoints: deep,
    endpoints_deep: deep,
  }
}

function card(id: string, path = `/api/${id}`): EndpointCard {
  return { interface_id: id, method: 'get', path, name: null, purpose: null }
}

function catalog(folders: Catalog['folders'], unplaced = 0): Catalog {
  return { project_id: 'p1', folders, unplaced }
}

const empty = {
  loaded: new Map<string, EndpointCard[]>(),
  expanded: new Set<string>(),
  loading: new Set<string>(),
}

describe('catalogue tree', () => {
  it('shows only folders while everything is collapsed', () => {
    const rows = flatten({ ...empty, catalog: catalog([folder('a', null, 0)], 3) })
    expect(rows.map((row) => row.key)).toEqual(['a', UNPLACED])
    expect(rows.every((row) => row.kind === 'folder')).toBe(true)
  })

  it('omits 待分类 when nothing is unplaced', () => {
    const rows = flatten({ ...empty, catalog: catalog([folder('a', null, 0)], 0) })
    expect(rows.map((row) => row.key)).toEqual(['a'])
  })

  // The user's correction: endpoints are children of a folder, not a separate list.
  it('puts a folder’s endpoints directly under it, one level deeper', () => {
    const rows = flatten({
      catalog: catalog([folder('a', null, 0, 2)], 0),
      loaded: new Map([['a', [card('e1'), card('e2')]]]),
      expanded: new Set(['a']),
      loading: new Set(),
    })
    expect(rows.map((row) => [row.key, row.kind, row.depth])).toEqual([
      ['a', 'folder', 0],
      ['a/e1', 'endpoint', 1],
      ['a/e2', 'endpoint', 1],
    ])
  })

  it('places sub-folders before a folder’s own endpoints', () => {
    const rows = flatten({
      catalog: catalog([folder('a', null, 0), folder('b', 'a', 0)], 0),
      loaded: new Map([['a', [card('e1')]]]),
      expanded: new Set(['a']),
      loading: new Set(),
    })
    expect(rows.map((row) => row.key)).toEqual(['a', 'b', 'a/e1'])
  })

  it('orders siblings by position, not by arrival', () => {
    const rows = flatten({
      ...empty,
      catalog: catalog([folder('late', null, 9), folder('early', null, 1)], 0),
    })
    expect(rows.map((row) => row.key)).toEqual(['early', 'late'])
  })

  it('treats 待分类 as an ordinary node with endpoint children', () => {
    const rows = flatten({
      catalog: catalog([], 2),
      loaded: new Map([[UNPLACED, [card('e1'), card('e2')]]]),
      expanded: new Set([UNPLACED]),
      loading: new Set(),
    })
    expect(rows.map((row) => [row.key, row.kind])).toEqual([
      [UNPLACED, 'folder'],
      [`${UNPLACED}/e1`, 'endpoint'],
      [`${UNPLACED}/e2`, 'endpoint'],
    ])
  })

  it('marks the last child so its guide rail stops', () => {
    const rows = flatten({
      catalog: catalog([folder('a', null, 0)], 0),
      loaded: new Map([['a', [card('e1'), card('e2')]]]),
      expanded: new Set(['a']),
      loading: new Set(),
    })
    expect(rows.map((row) => row.last)).toEqual([true, false, true])
  })

  it('reports a node as loading while its endpoints are in flight', () => {
    const rows = flatten({
      catalog: catalog([folder('a', null, 0)], 0),
      loaded: new Map(),
      expanded: new Set(['a']),
      loading: new Set(['a']),
    })
    expect(rows[0]).toMatchObject({ kind: 'folder', loading: true })
    expect(rows).toHaveLength(1)
  })

  it('hides the children of a folder that was collapsed again', () => {
    const rows = flatten({
      catalog: catalog([folder('a', null, 0)], 0),
      loaded: new Map([['a', [card('e1')]]]),
      expanded: new Set(),
      loading: new Set(),
    })
    expect(rows).toHaveLength(1)
  })
})

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
})

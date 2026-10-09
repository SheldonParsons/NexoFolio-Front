import { expect, it } from 'vitest'
import type { FieldFacts, FieldNote } from '@/contracts/knowledge/types'
import { compactFieldTree } from '@/features/documents/fieldTree'
type ValueType = FieldFacts['types'][number]

const field = (path: FieldFacts['path'], types: ValueType[]): FieldFacts => ({
  location: { in: 'response_body', status: 200 },
  path,
  types,
  labels: [],
  differs_between_environments: false,
  declared: null,
  conflict: null,
})

it('inlines object array elements without losing element notes, paths or child notes', () => {
  const fields = [
    field([{ key: 'data' }], ['array']),
    field([{ key: 'data' }, 'items'], ['object']),
    field([{ key: 'data' }, 'items', { key: 'id' }], ['number']),
  ]
  const itemNote = {
    path: 'response_body:200:data[]',
    text: '组织节点',
    context: {
      location: { in: 'response_body', status: 200 },
      field_path: 'data[]',
      input_hash: 'same-hash',
      evidence: [],
    },
  } as unknown as FieldNote
  const childNote = { path: 'response_body:200:data[].id', text: '组织ID' } as FieldNote
  const roots = compactFieldTree(fields, [itemNote, childNote])
  expect(roots[0]!.children[0]!.name).toBe('id')
  expect(roots[0]!.children[0]!.path).toBe('data[].id')
  expect(roots[0]!.children[0]!.note).toBe(childNote)
  expect(roots[0]!.item?.note).toBe(itemNote)
  expect(roots[0]!.item?.path).toBe('data[]')
  expect(fields).toHaveLength(3)
})

it('preserves primitive, polymorphic and nested array elements as distinct structures', () => {
  for (const types of [['string'], ['object', 'null'], ['array']] as ValueType[][]) {
    const roots = compactFieldTree(
      [
        field([{ key: 'data' }], ['array']),
        field([{ key: 'data' }, 'items'], types),
        field([{ key: 'data' }, 'items', { key: 'id' }], ['number']),
      ],
      [],
    )
    expect(roots[0]!.item).toBeUndefined()
    expect(roots[0]!.children[0]!.path).toBe('data[]')
  }
})

it('preserves standalone object element information if no child structure was observed', () => {
  const roots = compactFieldTree(
    [field([{ key: 'data' }], ['array']), field([{ key: 'data' }, 'items'], ['object'])],
    [],
  )
  expect(roots[0]!.children[0]!.name).toBe('每个元素')
  expect(roots[0]!.item).toBeUndefined()
})

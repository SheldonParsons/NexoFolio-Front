import { expect, it } from 'vitest'
import { sampleProjection } from '@/features/documents/samples/presentation'
import { groupFields } from '@/features/knowledge/fieldPresentation'
import { fieldKey } from '@/features/documents/fieldTree'
import type { FieldFacts } from '@/contracts/knowledge/types'
const record = (body: unknown) => ({
  fact: {
    request: {
      method: 'POST',
      url: 'https://fixture.test/api?x=1&x=2',
      headers: {
        complete: false,
        entries: [
          ['Authorization', 'Bearer synthetic'],
          ['X-Label', 'a'],
          ['X-Label', 'b'],
        ],
      },
      body,
    },
  },
})
it('distinguishes an empty JSON root from no body while preserving duplicate Header and query values', () => {
  const none = sampleProjection(record({ state: 'none' }), 'request')
  const empty = sampleProjection(
    record({ state: 'full', content: { encoding: 'text', data: '{}' } }),
    'request',
  )
  expect(none.state).toBe('none')
  expect(empty.state).toBe('full')
  expect(empty.complete).toBe(false) // headers remain partial
  expect(empty.value).toMatchObject({
    body: {},
    query: { x: ['1', '2'] },
    headers: {
      entries: [
        ['Authorization', 'Bearer synthetic'],
        ['X-Label', 'a'],
        ['X-Label', 'b'],
      ],
    },
  })
})
it('keeps usable multipart metadata without promoting it to full content', () => {
  const fields = [
    { name: 'label', value: '文字' },
    { name: 'upload', file: 'fixture.txt', type: 'text/plain', size: 4 },
  ]
  const partial = sampleProjection(
    record({
      state: 'partial',
      media_type: 'multipart/form-data',
      content: { encoding: 'text', data: JSON.stringify(fields) },
    }),
    'request',
  )
  expect(partial.complete).toBe(false)
  expect(partial.value).toMatchObject({ body_state: 'partial', body: fields })
})
it('gives Header and body locations distinct stable keys, including response status', () => {
  const make = (location: FieldFacts['location']): FieldFacts => ({
    location,
    path: [{ key: 'content-type' }],
    types: ['string'],
    labels: [],
    differs_between_environments: false,
    declared: null,
    conflict: null,
  })
  const fields = [
    make({ in: 'request_header' }),
    make({ in: 'response_header', status: 200 }),
    make({ in: 'response_header', status: 400 }),
  ]
  expect(new Set(fields.map(fieldKey)).size).toBe(3)
  expect(groupFields(fields).map((g) => g.label)).toEqual([
    '请求 Header',
    '响应 Header 200',
    '响应 Header 400',
  ])
})

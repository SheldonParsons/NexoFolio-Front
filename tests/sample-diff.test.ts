import { describe, expect, it } from 'vitest'
import { compareSamples } from '@/features/documents/samples/diff'
import { redactForDisplay, sampleProjection } from '@/features/documents/samples/presentation'
const pair = (a: unknown, b: unknown, complete = true) => [
  { id: 'a', value: a, complete: true },
  { id: 'b', value: b, complete },
]
describe('captured sample differences', () => {
  it('separates missing, null, changed value and changed type', () => {
    const diff = compareSamples(
      pair({ id: 1, gone: true, empty: null }, { id: '1', newValue: 0, empty: 2 }),
    )
    expect(diff.rows.find((r) => r.path === '/gone')!.cells[1]!.kind).toBe('removed')
    expect(diff.rows.find((r) => r.path === '/newValue')!.cells[1]!.kind).toBe('added')
    expect(diff.rows.find((r) => r.path === '/empty')!.cells[1]!.kind).toBe('changed')
    expect(diff.rows.find((r) => r.path === '/id')!.cells[1]).toMatchObject({
      kind: 'changed',
      type: 'string',
    })
  })
  it('does not claim a field is removed from a truncated sample', () => {
    const diff = compareSamples(pair({ visible: 1, tail: 2 }, { visible: 1 }, false))
    expect(diff.removed).toBe(0)
    expect(diff.unknown).toBe(1)
    expect(diff.rows.find((r) => r.path === '/tail')!.cells[1]!.kind).toBe('unknown')
  })
  it('compares three samples to the same chosen baseline', () => {
    const diff = compareSamples([
      ...pair({ code: 1 }, { code: 2 }),
      { id: 'c', value: { code: 3 }, complete: true },
    ])
    expect(diff.rows.find((r) => r.path === '/code')!.cells.map((c) => c.kind)).toEqual([
      'same',
      'changed',
      'changed',
    ])
  })
  it('offers explicit ID alignment without confusing array order with identity', () => {
    const input = pair(
      [
        { id: 1, name: '甲' },
        { id: 2, name: '乙' },
      ],
      [
        { id: 2, name: '乙' },
        { id: 1, name: '甲' },
      ],
    )
    expect(compareSamples(input, 'position').changed).toBeGreaterThan(0)
    expect(compareSamples(input, 'id').changed).toBe(0)
    expect(compareSamples(input, 'id').identifiedArrays).toBe(1)
    const repeated = compareSamples(pair([{ id: 1 }, { id: 1 }], [{ id: 1 }, { id: 2 }]), 'id')
    expect(repeated.identifiedArrays).toBe(0)
    expect(repeated.positionalArrays).toBe(1)
  })
  it('still exposes nested fields when an object changes from null', () => {
    const diff = compareSamples(pair({ data: null }, { data: { id: 7 } }))
    expect(diff.rows.find((r) => r.path === '/data/id')!.cells[1]!.text).toBe('7')
    expect(compareSamples(pair(null, [1, 2])).rows.some((r) => r.path === '/0')).toBe(true)
  })
  it('shows captured original value changes including header pairs', () => {
    const diff = compareSamples(
      pair(
        { password: 'private-a', headers: [['Cookie', 'private-cookie-a']] },
        { password: 'private-b', headers: [['Cookie', 'private-cookie-b']] },
      ),
    )
    expect(diff.modified).toBe(2)
    expect(JSON.stringify(diff)).toContain('private-cookie-b')
    expect(diff.rows.find((r) => r.path === '/password')!.cells[1]!.kind).toBe('changed')
  })
})
describe('sample projection and original display', () => {
  const raw = {
    fact: {
      kind: 'exchange',
      request: { url: 'https://example.test/item?id=7', body: { state: 'none' } },
      response: {
        body: {
          state: 'full',
          media_type: 'application/json',
          content: { encoding: 'text', data: '{"data":{"id":7},"access_token":"private-token"}' },
        },
      },
    },
  }
  it('decodes captured JSON and keeps real capture completeness', () => {
    const view = sampleProjection(raw, 'response')
    expect(view.complete).toBe(true)
    expect(view.value).toMatchObject({ data: { id: 7 } })
    expect(
      sampleProjection(
        {
          ...raw,
          fact: {
            ...raw.fact,
            response: {
              body: { state: 'truncated', content: { encoding: 'text', data: '{"id":' } },
            },
          },
        },
        'response',
      ).complete,
    ).toBe(false)
    expect(sampleProjection(raw, 'request').value).toMatchObject({ query: { id: '7' } })
  })
  it('preserves captured JSON strings, credentials in URLs and cookie header values', () => {
    const safe = JSON.stringify(
      redactForDisplay({
        ...raw,
        headers: [['Cookie', 'private-cookie']],
        url: 'https://user:private-password@example.test/?token=private-query',
      }),
    )
    expect(safe).toContain('private-token')
    expect(safe).toContain('private-cookie')
    expect(safe).toContain('private-query')
    expect(safe).not.toContain('已隐藏')
  })
})

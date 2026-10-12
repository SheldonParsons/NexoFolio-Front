import { candidateIndex } from '@/features/curation/candidateTree'
import type { Candidate } from '@/features/curation/types'
import { describe, it, expect } from 'vitest'
import {
  retirement,
  hiddenRetirement,
  sourceRetired,
  type DocumentLifecycle,
} from '@/features/documents/lifecycle/model'
import { documentTree, findFolder } from '@/features/documents/documentTree'
import fixture from './fixtures/document-navigation.json'
import type { DocumentIndex } from '@/features/documents/source'
const base = (): DocumentLifecycle => ({
  version: 1,
  reconciled_version: 0,
  decisions: [
    {
      target: { kind: 'folder', id: 'root' },
      reason: '旧目录',
      actor: { kind: 'user', display_name: 'test' },
      at: '2026-10-11T00:00:00Z',
      version: 1,
      retired: true,
      folders: ['root', 'child'],
    },
  ],
})
describe('reversible project document lifecycle', () => {
  it('retires the directory subtree while leaving member interfaces active', () => {
    const state = base()
    expect(retirement(state, { kind: 'folder', id: 'child' })).toBeDefined()
    expect(retirement(state, { kind: 'endpoint', id: 'endpoint-0' })).toBeUndefined()
    expect(hiddenRetirement(state, { kind: 'folder', id: 'root' })).toBe(false)
    const index = { ...(structuredClone(fixture) as DocumentIndex), lifecycle: state }
    expect(findFolder(documentTree(index, 'test-env'), 'child')).toBeDefined()
    state.reconciled_version = 1
    expect(findFolder(documentTree(index, 'test-env'), 'child')).toBeUndefined()
    expect(findFolder(documentTree(index, 'test-env', '', null, true), 'child')).toBeDefined()
  })
  it('matches object descendants by segments and location without confusing neighboring names', () => {
    const state = base()
    state.decisions[0]!.target = {
      kind: 'field',
      endpoint: 'a',
      location: { in: 'request_body' },
      path: [{ key: 'data' }],
    }
    state.decisions[0]!.folders = []
    const field = (path: string, location: 'request_body' | 'query' = 'request_body') => ({
      kind: 'field' as const,
      endpoint: 'a',
      location: { in: location },
      path: path.split('.').map((key) => ({ key })),
    })
    expect(retirement(state, field('data.id'))).toBeDefined()
    expect(retirement(state, field('database'))).toBeUndefined()
    expect(retirement(state, field('data.id', 'query'))).toBeUndefined()
    expect(retirement(state, { ...field('data.id'), path: [{ key: 'data.id' }] })).toBeUndefined()
    expect(sourceRetired(state, 'a', 'data.id', { in: 'request_body' })).toBe(true)
    expect(retirement(state, { kind: 'endpoint', id: 'consumer' })).toBeUndefined()
  })
  it('keeps a direct field decision when endpoint retirement is undone, including alias reads', () => {
    const state = base()
    state.decisions[0]!.target = {
      kind: 'field',
      endpoint: 'old',
      location: { in: 'request_body' },
      path: [],
    }
    state.aliases = [['old', 'current']]
    state.decisions.push({
      ...state.decisions[0]!,
      version: 2,
      target: { kind: 'endpoint', id: 'old' },
    })
    expect(
      retirement(state, {
        kind: 'field',
        endpoint: 'current',
        location: { in: 'query' },
        path: [],
      }),
    ).toBeDefined()
    state.decisions[1]!.retired = false
    expect(
      retirement(state, {
        kind: 'field',
        endpoint: 'current',
        location: { in: 'query' },
        path: [],
      }),
    ).toBeUndefined()
    expect(
      retirement(state, {
        kind: 'field',
        endpoint: 'current',
        location: { in: 'request_body' },
        path: [{ key: 'kept' }],
      }),
    ).toBeDefined()
  })
})

it('review history keeps frozen interfaces after the live endpoint has merged away', () => {
  const index = structuredClone(fixture) as DocumentIndex
  const original = index.entries[0]!
  const candidate = {
    project_id: index.catalog.project_id,
    view: {
      endpoints: [original.interface_id],
      folders: [],
      placements: [],
      notes: [],
      fields: [],
      links: [],
    },
    execution_input: { prepared: { facts: [{ summary: original.summary }] } },
  } as unknown as Candidate
  index.entries = []
  const retained = candidateIndex(candidate, index)
  expect(retained.entries[0]?.interface_id).toBe(original.interface_id)
  expect(retained.entries[0]?.path).toBe(original.summary.path_template)
  expect(index.entries).toHaveLength(0)
})

it('retirement follows both old aliases to the same canonical source', () => {
  const state = base()
  state.aliases = [
    ['old-a', 'current'],
    ['old-b', 'current'],
  ]
  state.decisions[0]!.target = { kind: 'endpoint', id: 'old-a' }
  expect(retirement(state, { kind: 'endpoint', id: 'old-b' })).toBeDefined()
  state.decisions[0]!.target = {
    kind: 'field',
    endpoint: 'old-a',
    location: { in: 'query' },
    path: [{ key: 'id' }],
  }
  expect(sourceRetired(state, 'old-b', 'id', { in: 'query' })).toBe(true)
  expect(sourceRetired(state, 'old-b', 'id', { in: 'request_body' })).toBe(false)
})

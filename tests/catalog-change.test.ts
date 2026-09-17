import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '../src/api/client'
import { useCatalogChange, type CatalogAttempt } from '../src/features/catalog/change'
import { createAttemptStore } from '../src/features/catalog/attemptStore'
import { liveCards } from '../src/features/catalog/liveCards'
import { catalogRows } from '../src/features/catalog/directoryRows'
import type { CatalogState, LiveCatalogInterface } from '../src/features/catalog/types'

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
})
function setup(
  overrides: {
    send?: ReturnType<typeof vi.fn>
    read?: ReturnType<typeof vi.fn>
    store?: ReturnType<typeof createAttemptStore>
  } = {},
) {
  const scope = effectScope()
  scopes.push(scope)
  const read = overrides.read ?? vi.fn().mockResolvedValue({ generation: 3 })
  const send =
    overrides.send ??
    vi.fn().mockImplementation(async (attempt: CatalogAttempt) => ({
      request_id: attempt.request_id,
      generation: 4,
      version_id: 'new-version',
      replayed: false,
    }))
  const store = overrides.store ?? createAttemptStore(crypto.randomUUID(), undefined)
  const updated = vi.fn()
  const unauthorized = vi.fn()
  const change = scope.run(() =>
    useCatalogChange(
      { read, generation: (state: { generation: number }) => state.generation, send },
      store,
      updated,
      unauthorized,
    ),
  )!
  return { scope, read, send, store, updated, unauthorized, change }
}

describe('explicit optimistic catalog activation', () => {
  it('never writes on mount or prepare; a confirmation sends one captured generation', async () => {
    const { change, send, updated } = setup()
    expect(send).not.toHaveBeenCalled()
    await change.prepare({ kind: 'publish', task_id: 'candidate-a' })
    expect(send).not.toHaveBeenCalled()
    await change.confirm()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      kind: 'publish',
      task_id: 'candidate-a',
      expected_generation: 3,
    })
    expect(change.phase.value).toBe('success')
    expect(updated).toHaveBeenCalledTimes(2)
  })
  it('blocks repeated clicks while the POST is pending', async () => {
    let resolve!: (value: unknown) => void
    const send = vi.fn().mockImplementation(
      (attempt) =>
        new Promise((done) => {
          resolve = () => done({ request_id: attempt.request_id, generation: 4, replayed: false })
        }),
    )
    const { change } = setup({ send })
    await change.prepare({ kind: 'restore', version_id: null })
    const pending = change.confirm()
    await change.confirm()
    await change.retry()
    expect(send).toHaveBeenCalledTimes(1)
    resolve(null)
    await pending
  })
  it('retries an uncertain response with exactly the same request, even after remount', async () => {
    const first = setup({ send: vi.fn().mockRejectedValue(new ApiError('timeout', 'timeout')) })
    await first.change.prepare({ kind: 'restore', version_id: 'version-a' })
    await first.change.confirm()
    const original = first.store.read()
    expect(first.change.phase.value).toBe('uncertain')
    first.scope.stop()
    const next = setup({ store: first.store })
    await next.change.prepare({ kind: 'publish', task_id: 'different' })
    expect(next.send).not.toHaveBeenCalled()
    expect(next.change.attempt.value).toEqual(original)
    expect(next.change.targetIntent.value).toEqual({ kind: 'restore', version_id: 'version-a' })
    await next.change.retry()
    expect(next.send.mock.calls[0]?.[0]).toEqual(original)
    expect(next.store.read()).toBeNull()
  })
  it('requires fresh GET and a new explicit confirmation after a 409', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('conflict', 'http', 409))
      .mockImplementation(async (attempt) => ({
        request_id: attempt.request_id,
        generation: 10,
        replayed: false,
      }))
    const read = vi
      .fn()
      .mockResolvedValueOnce({ generation: 3 })
      .mockResolvedValue({ generation: 9 })
    const { change } = setup({ send, read })
    await change.prepare({ kind: 'publish', task_id: 'candidate' })
    await change.confirm()
    const previous = send.mock.calls[0]?.[0]
    expect(change.phase.value).toBe('conflict')
    await change.retry()
    await change.confirm()
    expect(send).toHaveBeenCalledTimes(1)
    await change.refreshForConfirmation()
    expect(send).toHaveBeenCalledTimes(1)
    await change.confirm()
    expect(send.mock.calls[1]?.[0].expected_generation).toBe(9)
    expect(send.mock.calls[1]?.[0].request_id).not.toBe(previous.request_id)
  })
  it('only refreshes GET after a successful write whose follow-up read failed', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ generation: 3 })
      .mockRejectedValueOnce(new ApiError('offline', 'network'))
      .mockResolvedValue({ generation: 4 })
    const { change, send, store } = setup({ read })
    await change.prepare({ kind: 'restore', version_id: null })
    await change.confirm()
    expect(change.phase.value).toBe('refresh-error')
    expect(store.read()).toBeNull()
    await change.retry()
    await change.refreshAfterSuccess()
    expect(send).toHaveBeenCalledTimes(1)
    expect(change.phase.value).toBe('success')
  })
  it.each([401, 403, 404])('shows %i without automatic retry', async (status) => {
    const { change, send, unauthorized, store } = setup({
      send: vi.fn().mockRejectedValue(new ApiError('rejected', 'http', status)),
    })
    await change.prepare({ kind: 'publish', task_id: 'candidate' })
    await change.confirm()
    await change.retry()
    expect(send).toHaveBeenCalledTimes(1)
    expect(unauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0)
    expect(store.read()).toBeNull()
  })
  it('preserves an unresolved operation on disposal and ignores its late result', async () => {
    let resolve!: (result: unknown) => void
    const send = vi.fn().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const { change, scope, store, updated } = setup({ send })
    await change.prepare({ kind: 'restore', version_id: null })
    const pending = change.confirm()
    scope.stop()
    resolve({ request_id: store.read()?.request_id, generation: 4, replayed: false })
    await pending
    expect((send.mock.calls[0]?.[1] as AbortSignal).aborted).toBe(true)
    expect(store.read()).not.toBeNull()
    expect(updated).toHaveBeenCalledTimes(1)
  })
  it('isolates pending requests by API/user/project key', () => {
    const a = createAttemptStore('user-a:' + crypto.randomUUID(), undefined)
    const b = createAttemptStore('user-b:' + crypto.randomUUID(), undefined)
    a.save({
      kind: 'restore',
      version_id: null,
      request_id: crypto.randomUUID(),
      expected_generation: 1,
    })
    expect(b.read()).toBeNull()
    expect(a.read()?.kind).toBe('restore')
  })
})

describe('live directory presentation', () => {
  const state: CatalogState = {
    projectId: 'p',
    name: '',
    generation: 0,
    versionId: null,
    sourceTaskId: null,
    unclassifiedId: 'system',
    total: 2,
    nodes: [
      { id: 'system', parent: null, name: '待分类', description: '', count: 2, system: true },
    ],
    groups: [
      {
        representative_id: 'a',
        member_ids: ['a', 'b'],
        path_template: '/items/{id}',
        reason: 'same',
      },
    ],
  }
  const items: LiveCatalogInterface[] = [
    {
      id: 'a',
      method: 'GET',
      path: '/items/1',
      environments: [{ id: 'env', name: 'UAT', revisionId: 'rev-a' }],
    },
    {
      id: 'b',
      method: 'GET',
      path: '/items/2',
      environments: [{ id: 'env', name: 'UAT', revisionId: 'rev-b' }],
    },
  ]
  it('keeps cross-page group members visible and distinct', () => {
    const full = liveCards(state, items)
    expect(full.cards).toHaveLength(1)
    expect(full.cards[0]?.members.map((member) => member.environments[0]?.revisionId)).toEqual([
      'rev-a',
      'rev-b',
    ])
    const partial = liveCards(state, items.slice(1))
    expect(partial.cards[0]?.path).toBe('/items/2')
    expect(partial.partial).toBe(true)
  })
  it('does not include the fixed system directory in the reorganized tree', () => {
    expect(catalogRows(state.nodes, state.unclassifiedId).rows).toEqual([])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as source from '@/contracts/knowledge/source'
import { api } from '@/api'

// `restoreMocks` runs between tests, so the spy is installed per test.
let request: ReturnType<typeof vi.spyOn<typeof api, 'request'>>
beforeEach(() => {
  request = vi.spyOn(api, 'request')
})

describe('curate calls', () => {
  it('posts the describe pass at one endpoint of one project', async () => {
    request.mockResolvedValue({ status: 'ok' })
    await expect(source.describeEndpoint('p 1', 'e/1')).resolves.toEqual({ status: 'ok' })
    const [path, options] = request.mock.calls[0]!
    expect(path).toBe('v1/projects/p%201/curate/describe/e%2F1')
    expect(options?.method).toBe('POST')
  })

  it('posts the organize pass at the project', async () => {
    request.mockResolvedValue({ status: 'ok', commands: 12 })
    await expect(source.organizeProject('p1')).resolves.toEqual({ status: 'ok', commands: 12 })
    expect(request.mock.calls[0]![0]).toBe('v1/projects/p1/curate/organize')
  })

  // A model reply over dozens of endpoints outlasts the client default of 15s.
  it('gives both passes a timeout long enough for a model', async () => {
    request.mockResolvedValue({ status: 'skipped' })
    await source.describeEndpoint('p1', 'e1')
    await source.organizeProject('p1')
    for (const call of request.mock.calls) {
      expect(call[1]?.timeoutMs).toBeGreaterThanOrEqual(60_000)
    }
  })

  it('reads a folder page and the unplaced page from different routes', async () => {
    request.mockResolvedValue({ items: [], total: 0, page: 1, limit: 100 })
    await source.interfaces('p1', 'f1', 2, 50)
    await source.unclassified('p1', 1, 50)
    expect(request.mock.calls[0]![0]).toBe(
      'v1/projects/p1/catalog/interfaces?directory_id=f1&page=2&limit=50',
    )
    expect(request.mock.calls[1]![0]).toBe('v1/projects/p1/catalog/unclassified?page=1&limit=50')
  })
})

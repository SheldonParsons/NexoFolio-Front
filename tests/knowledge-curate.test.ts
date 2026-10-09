import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as source from '@/contracts/knowledge/source'
import { api } from '@/api'

// `restoreMocks` runs between tests, so the spy is installed per test.
let request: MockInstance<typeof api.request>
beforeEach(() => {
  request = vi.spyOn(api, 'request')
})

describe('curate calls', () => {
  it('posts the describe pass at one endpoint of one project', async () => {
    request.mockResolvedValue({ status: 'running', candidate_id: 'c1' })
    await expect(source.describeEndpoint('p 1', 'e/1')).resolves.toEqual({
      status: 'running',
      candidate_id: 'c1',
    })
    const [path, options] = request.mock.calls[0]!
    expect(path).toBe('v1/projects/p%201/curate/describe/e%2F1')
    expect(options?.method).toBe('POST')
  })

  it('starts the project workflow and reads its progress through the same scoped resource', async () => {
    request.mockResolvedValue({ status: 'running', completed: 0, total: 47 })
    await expect(source.startCurate('p1')).resolves.toMatchObject({ status: 'running', total: 47 })
    expect(request.mock.calls[0]![0]).toBe('v1/projects/p1/curate')
    expect(request.mock.calls[0]![1]?.method).toBe('POST')
    await source.curateProgress('p1')
    expect(request.mock.calls[1]![0]).toBe('v1/projects/p1/curate')
  })

  // Both entry points now start a reviewable background job.
  it('returns promptly for both single-endpoint and whole-project background jobs', async () => {
    request.mockResolvedValue({ status: 'running' })
    await source.describeEndpoint('p1', 'e1')
    await source.startCurate('p1')
    expect(request.mock.calls[0]![1]?.timeoutMs).toBe(15_000)
    expect(request.mock.calls[1]![1]?.timeoutMs).toBe(15_000)
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

it('resumes and cancels the exact candidate through dedicated routes', async () => {
  request.mockResolvedValue({ status: 'running', candidate_id: 'c/1' })
  await source.resumeCandidate('p 1', 'c/1')
  await source.cancelCandidate('p 1', 'c/1')
  expect(request.mock.calls[0]![0]).toBe('v1/projects/p%201/curate/candidates/c%2F1/resume')
  expect(request.mock.calls[1]![0]).toBe('v1/projects/p%201/curate/candidates/c%2F1/cancel')
  expect(request.mock.calls.every(([, options]) => options?.method === 'POST')).toBe(true)
})

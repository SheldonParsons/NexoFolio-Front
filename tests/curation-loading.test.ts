import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCurationReview } from '@/features/curation/useCurationReview'
import * as source from '@/features/curation/source'
import { projectSource } from '@/features/projects/source'
import { api } from '@/api'
import type { Candidate, CandidateSummary } from '@/features/curation/types'
import type { Project } from '@/features/projects/types'
import type { DocumentIndex } from '@/features/documents/source'

vi.mock('@/features/projects/source', () => ({ projectSource: { get: vi.fn() } }))
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.restoreAllMocks()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const project = (pid = 'p'): Project => ({
  project_id: pid,
  name: pid,
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
})
const summary = (id = 'c', pid = 'p'): CandidateSummary => ({
  id,
  project_id: pid,
  target: null,
  state: 'ready',
  created_at: '',
  updated_at: '',
  commands: 0,
  progress: {},
})
const index = (pid = 'p'): DocumentIndex => ({
  catalog: { project_id: pid, folders: [], unplaced: 0 },
  entries: [],
})
function candidate(id = 'c', pid = 'p'): Candidate {
  const { commands: _, ...value } = summary(id, pid)
  const snapshot = { endpoints: [], folders: [], placements: [], notes: [], fields: [], links: [] }
  return {
    ...value,
    parent: null,
    base_hash: 'fixture',
    base: snapshot,
    view: snapshot,
    batches: [],
    applied_rounds: [],
    reviewed_by: null,
  }
}
function fixture(initialId = '') {
  const pid = ref('p'),
    cid = ref(initialId),
    scope = effectScope()
  scopes.push(scope)
  const value = scope.run(() =>
    useCurationReview(
      () => pid.value,
      () => cid.value,
      vi.fn(),
    ),
  )!
  return { value, pid, cid }
}
it('shows history as soon as its response arrives, without awaiting metadata or loading endpoint facts', async () => {
  const metadata = deferred<Project>()
  vi.spyOn(projectSource, 'get').mockReturnValue(metadata.promise)
  vi.spyOn(source, 'candidates').mockResolvedValue([summary()])
  const facts = vi.spyOn(source, 'factsIndex').mockResolvedValue(index())
  const f = fixture()
  await vi.waitFor(() => expect(f.value.loading.value).toBe(false))
  expect(f.value.list.value).toHaveLength(1)
  expect(f.value.project.value).toBeNull()
  expect(facts).not.toHaveBeenCalled()
  metadata.resolve(project())
  await vi.waitFor(() => expect(f.value.project.value?.project_id).toBe('p'))
})
it('requests a candidate directly and does not hold it behind history or facts reads', async () => {
  const history = deferred<CandidateSummary[]>(),
    facts = deferred<DocumentIndex>()
  vi.spyOn(projectSource, 'get').mockResolvedValue(project())
  vi.spyOn(source, 'candidates').mockReturnValue(history.promise)
  vi.spyOn(source, 'factsIndex').mockReturnValue(facts.promise)
  const detail = vi.spyOn(source, 'candidate').mockResolvedValue(candidate())
  const f = fixture('c')
  await vi.waitFor(() => expect(f.value.loading.value).toBe(false))
  expect(detail).toHaveBeenCalledTimes(1)
  expect(f.value.candidate.value?.id).toBe('c')
  expect(f.value.indexLoading.value).toBe(true)
  expect(f.value.index.value).toBeNull()
  history.resolve([summary()])
  facts.resolve(index())
  await vi.waitFor(() => expect(f.value.indexLoading.value).toBe(false))
})
it('rejects late detail and metadata from a previous route scope', async () => {
  const old = deferred<Candidate>()
  vi.spyOn(projectSource, 'get').mockImplementation((pid) => Promise.resolve(project(pid)))
  vi.spyOn(source, 'candidates').mockImplementation((pid) => Promise.resolve([summary('c', pid)]))
  vi.spyOn(source, 'factsIndex').mockImplementation((pid) => Promise.resolve(index(pid)))
  vi.spyOn(source, 'candidate').mockImplementation((pid, id) =>
    pid === 'p' ? old.promise : Promise.resolve(candidate(id, pid)),
  )
  const f = fixture('c')
  f.pid.value = 'q'
  f.cid.value = 'next'
  await nextTick()
  await vi.waitFor(() => expect(f.value.candidate.value?.id).toBe('next'))
  old.resolve(candidate('c', 'p'))
  await nextTick()
  expect(f.value.candidate.value?.project_id).toBe('q')
  expect(f.value.project.value?.project_id).toBe('q')
  expect(f.value.index.value?.catalog.project_id).toBe('q')
})
it('builds preview facts with one summary request instead of the approved directory pages', async () => {
  const request = vi
    .spyOn(api, 'request')
    .mockResolvedValueOnce({
      endpoints: [
        {
          id: 'e',
          project_id: 'p',
          method: 'GET',
          path_template: '/items',
          environments: [],
          declared: false,
          external: false,
        },
      ],
    })
    .mockResolvedValueOnce({ version: 7, reconciled_version: 6, decisions: [] })
  const result = await source.factsIndex('p')
  expect(result.lifecycle?.version).toBe(7)
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls[1]?.[0]).toBe('v1/projects/p/document-lifecycle')
  expect(request.mock.calls[0]?.[0]).toBe('v1/projects/p/endpoints')
  expect(result.entries[0]).toMatchObject({
    interface_id: 'e',
    method: 'GET',
    path: '/items',
    name: null,
    folderId: null,
  })
})

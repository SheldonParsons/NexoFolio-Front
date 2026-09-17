import { describe, expect, it, vi } from 'vitest'
import { createCatalogSource } from '../src/features/catalog/source'
import type { CatalogAttempt } from '../src/features/catalog/change'
import { contractResponse } from '../src/features/documents/contract'
import type { ObservedDefinition } from '../src/features/documents/types'

const project = '1b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const directory = '2b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const id = '3b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const version = '4b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const signal = () => new AbortController().signal
const current = () => ({
  project_id: project,
  generation: 0,
  version_id: null,
  source_task_id: null,
  unclassified_id: directory,
  total_interfaces: 1,
  nodes: [
    {
      id: directory,
      parent: null,
      name: '待分类',
      description: '',
      system: true,
      locked: true,
      direct_interfaces: 1,
    },
  ],
  merge_groups: [],
})
describe('official catalog generated contracts', () => {
  it('maps the fixed system directory and live environment revision references', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(current())
      .mockResolvedValueOnce({
        generation: 0,
        page: 1,
        limit: 100,
        total: 1,
        items: [
          {
            interface_id: id,
            method: 'GET',
            path: '/orders',
            directory_id: directory,
            environments: [{ environment_id: id, environment_name: 'UAT', revision_id: version }],
          },
        ],
      })
    const source = createCatalogSource(request)
    expect((await source.current(project, signal())).unclassifiedId).toBe(directory)
    const page = await source.interfaces(project, directory, 1, 0, signal())
    expect(request.mock.calls[1]?.[0]).toContain('expected_generation=0')
    expect(page.items[0]?.environments[0]?.revisionId).toBe(version)
  })
  it.each(['project', 'system', 'locked'])('rejects wrong %s identity', async (field) => {
    const response = current()
    if (field === 'project') response.project_id = id
    if (field === 'system') response.nodes[0]!.system = false
    if (field === 'locked') response.nodes[0]!.locked = false
    await expect(
      createCatalogSource(vi.fn().mockResolvedValue(response)).current(project, signal()),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('rejects an interface page from another generation', async () => {
    const source = createCatalogSource(
      vi.fn().mockResolvedValue({ generation: 2, page: 1, limit: 100, total: 0, items: [] }),
    )
    await expect(source.interfaces(project, directory, 1, 1, signal())).rejects.toMatchObject({
      kind: 'invalid-response',
    })
  })
  it('sends explicit null to restore the initial directory and allows a no-op receipt', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ request_id: id, generation: 0, version_id: null, replayed: false })
    const source = createCatalogSource(request)
    await source.change(
      project,
      { kind: 'restore', version_id: null, expected_generation: 0, request_id: id },
      signal(),
    )
    expect(request.mock.calls[0]?.[0]).toBe(`v1/projects/${project}/catalog/restore`)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      json: { version_id: null, expected_generation: 0, request_id: id },
      cache: 'no-store',
    })
    expect(request.mock.calls[0]?.[1].json).not.toHaveProperty('kind')
  })
  it('rejects a restore with an omitted target before any request', async () => {
    const request = vi.fn()
    const attempt = { kind: 'restore', expected_generation: 0, request_id: id } as CatalogAttempt
    await expect(
      createCatalogSource(request).change(project, attempt, signal()),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
    expect(request).not.toHaveBeenCalled()
  })
  it('binds publication receipts to the original request ID', async () => {
    const source = createCatalogSource(
      vi.fn().mockResolvedValue({
        request_id: project,
        generation: 1,
        version_id: version,
        replayed: false,
      }),
    )
    await expect(
      source.change(
        project,
        { kind: 'publish', task_id: version, expected_generation: 0, request_id: id },
        signal(),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it.each(['observed-http-1', 'observed-http-2'] as const)(
    'accepts classified documents with %s after publication',
    (extractorVersion) => {
      const definition: ObservedDefinition = {
        extractor_version: extractorVersion,
        method: 'GET',
        path: '/orders',
        request: { parameters: [], headers: [], body: { state: 'none', media_type: '' } },
        response: {
          status: 200,
          capture_state: 'captured',
          headers: [],
          body: { state: 'none', media_type: '' },
        },
        limitations: [],
      }
      expect(
        contractResponse('InterfaceDetail', {
          interface_id: id,
          project_id: project,
          environment: { id: directory, name: 'UAT' },
          method: 'GET',
          path: '/orders',
          revision_id: version,
          state: 'observed',
          classification: 'classified',
          definition,
          origin_ingestion_id: id,
          created_at: '2026-09-15T08:00:00Z',
          pending_difference_count: 0,
        }).classification,
      ).toBe('classified')
    },
  )
})

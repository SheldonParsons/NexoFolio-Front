import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMaintenanceSource } from '../src/features/maintenance/source'
import { maintenanceEvidenceReader } from '../src/features/maintenance/evidenceSource'
import { createCatalogSource } from '../src/features/catalog/source'
import { catalogOrigin } from '../src/features/catalog/origin'
import { contractResponse } from '../src/features/documents/contract'

const p = '1b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const run = '2b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const id = '3b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
const signal = () => new AbortController().signal
afterEach(() => vi.unstubAllGlobals())
describe('checkpoint and evidence contract upgrades', () => {
  it('reads actual review units, field references and inert summary/data', async () => {
    const checkpoint = {
      id: 'summary-1',
      phase: 'review',
      summary: '<script>inert</script>',
      references: [{ kind: 'field', id: 'field-a' }],
      review: {
        segment_id: 'segment-a',
        summary: 'review summary',
        assessments: [
          {
            unit_id: 'unit-a',
            field_id: 'field-a',
            disposition: 'keep',
            note: 'note',
            evidence: [],
          },
        ],
      },
      data: { count: 1 },
    }
    const request = vi.fn().mockResolvedValue({ items: [checkpoint], page: 1, limit: 20, total: 1 })
    const value = await createMaintenanceSource(request).checkpoints(p, run, 1, signal())
    expect(request.mock.calls[0]?.[0]).toBe(
      `v1/projects/${p}/maintenance-runs/${run}/checkpoints?page=1&limit=20`,
    )
    expect(value.items[0]?.review?.assessments[0]?.unit_id).toBe('unit-a')
    expect(value.items[0]?.summary).toBe('<script>inert</script>')
  })
  it('reads a fact directly and preserves observation IDs, rejecting another project', async () => {
    const fact = {
      id,
      project_id: p,
      environment_id: run,
      kind: 'ui-value',
      data: { value: null },
      subject: {},
      samples: [run],
      observations: 1,
      first_seen: '2026-09-15T00:00:00Z',
      last_seen: '2026-09-15T00:00:00Z',
    }
    const request = vi.fn().mockResolvedValue(fact)
    const source = createMaintenanceSource(request)
    expect((await source.fact(p, id, signal())).samples).toEqual([run])
    expect(request.mock.calls[0]?.[0]).toBe(`v1/projects/${p}/evidence/${id}`)
    request.mockResolvedValue({ ...fact, project_id: run })
    await expect(source.fact(p, id, signal())).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('resolves summary references through checkpoint pagination, without a snapshot/model request', async () => {
    vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5173' } })
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'other', phase: 'review', references: [], data: null }],
        page: 1,
        limit: 20,
        total: 21,
      })
      .mockResolvedValueOnce({
        items: [
          { id: 'target', phase: 'summary', references: [], summary: 'complete text', data: null },
        ],
        page: 2,
        limit: 20,
        total: 21,
      })
    const reader = maintenanceEvidenceReader(() => ({}), createMaintenanceSource(request))
    const result = await reader.read(
      p,
      {
        id: 'target',
        projectId: p,
        runId: run,
        kind: 'text',
        resource: 'summary',
        label: 'summary',
      },
      signal(),
    )
    expect(result.kind).toBe('text')
    if (result.kind === 'text') expect(result.text).toContain('complete text')
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.every(([path]) => path.includes('/checkpoints?'))).toBe(true)
  })
})
describe('directory origin and expired raw records', () => {
  it('keeps maintenance-run sources out of old preview links, including nullable task IDs', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        items: [
          {
            version_id: id,
            source_task_id: null,
            source_run_id: run,
            created_at: '2026-09-15T00:00:00Z',
            current: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        generation: 1,
      })
    const version = (await createCatalogSource(request).versions(p, 1, signal())).items[0]!
    expect(version.taskId).toBeNull()
    expect(catalogOrigin(p, version)?.to).toBe(`/projects/${p}/maintenance?run=${run}`)
    expect(catalogOrigin(p, { taskId: id })?.to).toBe(`/projects/${p}/catalog-preview?task=${id}`)
    expect(catalogOrigin(p, { taskId: null, runId: null })).toBeNull()
  })
  it('accepts expired raw_record null while retaining observation/difference metadata', () => {
    const value = contractResponse('ObservationDetail', {
      ingestion_id: id,
      project_id: p,
      environment_id: run,
      status: 'completed',
      attempts: 1,
      error_code: null,
      interface_id: id,
      outcome: 'difference_recorded',
      compared_revision_id: id,
      difference_id: run,
      proposed_definition: null,
      raw_record: null,
    })
    expect(value.raw_record).toBeNull()
    expect(value.difference_id).toBe(run)
  })
})

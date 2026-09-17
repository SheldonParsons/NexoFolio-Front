import { afterEach, expect, it, vi } from 'vitest'
import { maintenanceEvidenceReader } from '../src/features/maintenance/evidenceSource'
import { createMaintenanceSource } from '../src/features/maintenance/source'
import { evidenceRefs } from '../src/features/maintenance/mapping'
import type {
  CatalogInterface,
  KnowledgeSnapshot,
  MaintenanceRun,
} from '../src/contracts/maintenance/2.0.0/types.generated'

afterEach(() => vi.unstubAllGlobals())

it('reads interface evidence from its source-run snapshot, never the live definition or another run', async () => {
  vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5173' } })
  const project = '1b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const runId = '2b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const snapshotId = '3b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const interfaceId = '4b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const environment = '5b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const revision = '6b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const otherRun = '7b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const otherSnapshot = '8b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e'
  const original: CatalogInterface = {
    interface_id: interfaceId,
    method: 'GET',
    path: '/orders/{id}',
    environments: [
      {
        environment_id: environment,
        environment_name: 'UAT',
        revision_id: revision,
        definition: { response: { status: { type: 'string' } }, marker: 'source-snapshot' },
      },
    ],
  }
  const live: CatalogInterface = {
    ...original,
    environments: [
      {
        ...original.environments[0]!,
        revision_id: otherSnapshot,
        definition: { response: { status: { type: 'integer' } }, marker: 'live-definition' },
      },
    ],
  }
  const run: MaintenanceRun = {
    id: runId,
    project_id: project,
    snapshot_id: snapshotId,
    base_generation: 1,
    status: 'pending',
    phase: 'index',
    created_at: '2026-09-15T00:00:00Z',
    currently_published: false,
    model_calls: 0,
    read_count: 0,
    candidate: null,
    coverage: {
      complete: false,
      completed_segments: 0,
      total_segments: 1,
      reviewed_fields: 0,
      total_fields: 1,
      total_interfaces: 1,
    },
  }
  const snapshot: KnowledgeSnapshot = {
    id: snapshotId,
    project_id: project,
    base_generation: 1,
    pending_observations: 0,
    system_directory_id: environment,
    interfaces: [original],
    fields: [],
    facts: [],
    annotations: [],
    catalog: { nodes: [], assignments: [] },
  }
  const runPath = `v1/projects/${project}/maintenance-runs/${runId}`
  const liveRequest = vi.fn().mockResolvedValue(live)
  const request = vi.fn(async (path: string) => {
    if (path === runPath) return run
    if (path === `${runPath}/snapshot`) return snapshot
    if (path.includes('/interfaces/')) return liveRequest()
    throw new Error(`Unexpected request: ${path}`)
  })
  const reader = maintenanceEvidenceReader(
    () => ({
      run: { ...run, id: otherRun, snapshot_id: otherSnapshot },
      snapshot: { ...snapshot, id: otherSnapshot, interfaces: [live] },
    }),
    createMaintenanceSource(request),
  )
  const reference = evidenceRefs(project, [{ kind: 'interface', id: interfaceId }], runId)[0]!
  const result = await reader.read(project, reference, new AbortController().signal)
  expect(result.kind).toBe('text')
  if (result.kind !== 'text') throw new Error('Expected interface snapshot text')
  expect(JSON.parse(result.text)).toEqual({
    source_run_id: runId,
    snapshot_id: snapshotId,
    interface: original,
  })
  expect(result.text).not.toContain('live-definition')
  expect(liveRequest).not.toHaveBeenCalled()
  expect(request.mock.calls.map(([path]) => path)).toEqual([runPath, `${runPath}/snapshot`])
})

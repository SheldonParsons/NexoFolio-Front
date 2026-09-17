import { describe, expect, it, vi } from 'vitest'
import { createMaintenanceSource, createRebuildPort } from '../src/features/maintenance/source'
import {
  candidateChanges,
  semanticDocument,
  taskProgress,
} from '../src/features/maintenance/mapping'
import { maintenanceResponse } from '../src/features/maintenance/contract'
import type {
  InterfaceKnowledge,
  KnowledgeSnapshot,
  MaintenanceRun,
} from '../src/contracts/maintenance/2.0.0/types.generated'

const ids = Array.from({ length: 8 }, (_, i) => `${i + 1}b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e`)
const [project, runId, snapshotId, interfaceId, env, revision, annotationId, requestId] = ids as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]
const signal = () => new AbortController().signal
const coverage = {
  complete: false,
  completed_segments: 0,
  reviewed_fields: 0,
  total_fields: 2,
  total_interfaces: 1,
  total_segments: 1,
}
function run(): MaintenanceRun {
  return {
    id: runId,
    project_id: project,
    snapshot_id: snapshotId,
    status: 'pending',
    base_generation: 3,
    created_at: '2026-09-15T08:00:00Z',
    currently_published: false,
    coverage,
    phase: 'pending',
    model_calls: 0,
    read_count: 0,
    candidate: null,
    error_code: null,
  }
}
function knowledge(): InterfaceKnowledge {
  return {
    interface_id: interfaceId,
    environment_id: env,
    generation: 3,
    revision_id: revision,
    knowledge_version_id: null,
    annotations: [
      {
        annotation: {
          id: annotationId,
          target: {
            kind: 'field',
            field: {
              interface_id: interfaceId,
              environment_id: env,
              revision_id: revision,
              location: 'request.query',
              path: 'status',
            },
          },
          value: {
            kind: 'enum',
            complete: false,
            scope: { page: 'observed' },
            entries: [
              { state: 'present', value: null, label: '显式空' },
              { state: 'omitted', value: null },
              { state: 'unknown', value: null },
            ],
          },
          verification: 'inferred',
          evidence: [{ kind: 'fact', id: requestId }],
          note: '',
        },
        basis: [{ interface_id: interfaceId, environment_id: env, revision_id: revision }],
        stale: true,
        source_run_id: runId,
      },
    ],
  }
}
function snapshot(): KnowledgeSnapshot {
  return {
    id: snapshotId,
    project_id: project,
    base_generation: 3,
    base_catalog_version: null,
    base_knowledge_version: null,
    system_directory_id: env,
    pending_observations: 4,
    fields: [],
    facts: [],
    interfaces: [],
    annotations: knowledge().annotations,
    catalog: { nodes: [], assignments: [], merge_groups: [] },
  }
}

describe('maintenance HTTP contracts', () => {
  it('reads old snapshots and read-only observation fields without inventing revisions', () => {
    expect(maintenanceResponse('snapshot', snapshot()).inputs).toBeUndefined()
    const observed = {
      interface_id: interfaceId,
      environment_id: env,
      location: 'response.body',
      path: '/new_id',
      observation: {
        project_id: project,
        interface_id: interfaceId,
        environment_id: env,
        ingestion_id: requestId,
        location: 'response.body',
        path: '/new_id',
      },
    }
    const value = {
      ...snapshot(),
      inputs: { observations: [], sources: [], gaps: { observation_fields_without_definition: 1 } },
      fields: [
        {
          id: 'f_observed',
          reference: observed,
          schema: null,
          schema_pointers: [],
          ancestors: [],
          existing_annotations: [],
        },
      ],
    }
    const decoded = maintenanceResponse('snapshot', value)
    expect(decoded.fields[0]?.reference).toEqual(observed)
    expect(decoded.inputs?.gaps.observation_fields_without_definition).toBe(1)
    expect(() =>
      maintenanceResponse('snapshot', {
        ...value,
        fields: [{ ...value.fields[0], reference: { ...observed, revision_id: revision } }],
      }),
    ).toThrow()
  })

  it('starts only through its explicit POST and sends only the idempotency request ID', async () => {
    const request = vi.fn().mockResolvedValue(run())
    const source = createRebuildPort(request)
    expect(request).not.toHaveBeenCalled()
    expect(await source.start({ projectId: project, requestKey: requestId }, signal())).toEqual({
      projectId: project,
      taskId: runId,
    })
    expect(request.mock.calls[0]?.[0]).toBe(`v1/projects/${project}/maintenance-runs`)
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      json: { request_id: requestId },
    })
    expect(Object.keys(request.mock.calls[0]?.[1].json)).toEqual(['request_id'])
  })
  it('accepts summaries without candidates and binds detailed task/snapshot reads', async () => {
    const { candidate: _candidate, ...summary } = run()
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ ...summary, candidate_available: false }],
        total: 1,
        page: 1,
        limit: 20,
      })
      .mockResolvedValueOnce(snapshot())
    const source = createMaintenanceSource(request)
    expect((await source.list(project, 1, signal())).items).toHaveLength(1)
    expect((await source.snapshot(project, runId, snapshotId, signal())).id).toBe(snapshotId)
    await expect(
      createMaintenanceSource(vi.fn().mockResolvedValue({ ...run(), project_id: env })).run(
        project,
        runId,
        signal(),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('publishes with path-bound run ID and restores explicit null with generation/request identity', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        request_id: requestId,
        generation: 4,
        version_id: runId,
        catalog_version_id: runId,
        replayed: false,
        changed: true,
      })
      .mockResolvedValueOnce({
        request_id: requestId,
        generation: 5,
        version_id: null,
        catalog_version_id: null,
        replayed: true,
        changed: true,
      })
    const source = createMaintenanceSource(request)
    await source.change(
      project,
      { kind: 'publish', task_id: runId, expected_generation: 3, request_id: requestId },
      signal(),
    )
    expect(request.mock.calls[0]?.[0]).toBe(
      `v1/projects/${project}/maintenance-runs/${runId}/publish`,
    )
    expect(request.mock.calls[0]?.[1].json).toEqual({
      request_id: requestId,
      expected_generation: 3,
    })
    await source.change(
      project,
      { kind: 'restore', version_id: null, expected_generation: 4, request_id: requestId },
      signal(),
    )
    expect(request.mock.calls[1]?.[1].json).toEqual({
      request_id: requestId,
      expected_generation: 4,
      version_id: null,
    })
  })
  it('rejects another environment and another receipt identity', async () => {
    const source = createMaintenanceSource(
      vi.fn().mockResolvedValue({ ...knowledge(), environment_id: project }),
    )
    await expect(source.knowledge(project, interfaceId, env, signal())).rejects.toMatchObject({
      kind: 'invalid-response',
    })
    const mismatch = createMaintenanceSource(
      vi.fn().mockResolvedValue({
        request_id: env,
        generation: 4,
        version_id: runId,
        catalog_version_id: null,
        replayed: false,
        changed: true,
      }),
    )
    await expect(
      mismatch.change(
        project,
        { kind: 'publish', task_id: runId, expected_generation: 3, request_id: requestId },
        signal(),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('keeps unavailable observation payloads explicit', () => {
    const value = maintenanceResponse('observation', {
      id: requestId,
      project_id: project,
      environment_id: env,
      actor_id: interfaceId,
      record_id: revision,
      kind: 'ui_snapshot',
      captured_at: '2026-09-15T08:00:00Z',
      payload: null,
      payload_available: false,
      context: null,
      evidence_status: 'available',
      structure: 'not_applicable',
      ingestion_id: null,
      error_code: null,
    })
    expect(value.payload_available).toBe(false)
    expect(value.payload).toBeNull()
  })
})

describe('maintenance presentation mapping', () => {
  it('uses server stale and preserves omitted/present-null/unknown independently', () => {
    const value = semanticDocument(project, knowledge())
    const field = value.fields[0]!
    expect(field.stale).toBe(true)
    expect(field.boundRevision).toBe(field.currentRevision)
    expect(field.enumeration.scope).toBe('observed-only')
    expect(field.enumeration.values.map((entry) => entry.sample.kind)).toEqual([
      'null',
      'missing',
      'unknown',
    ])
    expect(field.enumeration.evidence[0]?.runId).toBe(runId)
  })
  it('does not fabricate shard records or failed counts from aggregate coverage', () => {
    const task = taskProgress(run())
    expect(task.shards).toEqual([])
    expect(task.coverage.failed).toBeNull()
    expect(task.readback.state).toBe('unknown')
    expect(task.segments).toEqual({ completed: 0, total: 1 })
  })
  it('distinguishes an unread baseline from a known absent annotation, and splits enum labels/scope', () => {
    const value = run()
    const annotation = knowledge().annotations[0]!.annotation
    value.candidate = {
      annotations: [],
      catalog: { nodes: [], assignments: [] },
      coverage,
      issues: [],
      plan: {
        strategy: 'partial',
        reason: 'reason',
        expected_benefit: 'benefit',
        actions: [
          {
            kind: 'upsert_annotation',
            annotation: {
              ...annotation,
              value: { kind: 'enum', complete: true, scope: 'explicit range', entries: [] },
            },
            reason: '<script>text only</script>',
          },
        ],
      },
      review: {
        structurally_valid: true,
        issues: [],
        warnings: [],
        metrics: {
          snapshot_interfaces: 1,
          assigned_interfaces: 0,
          unclassified_interfaces: 1,
          unclassified_ratio: 1,
          directory_count: 0,
          max_depth: 0,
          directories: [],
        },
      },
    }
    const unread = candidateChanges(value, null)
    expect(unread.changes).toHaveLength(2)
    expect(unread.changes[0]?.before).toEqual({ present: false, known: false })
    const compared = candidateChanges(value, snapshot())
    expect(compared.changes.map((change) => change.kind)).toEqual(['enum-label', 'enum-scope'])
    expect(compared.changes[1]?.before).toEqual({
      present: true,
      value: { complete: false, scope: { page: 'observed' } },
    })
    expect(compared.changes[0]?.reason).toBe('<script>text only</script>')
  })
})

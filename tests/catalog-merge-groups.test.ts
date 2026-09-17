import { describe, expect, it, vi } from 'vitest'
import { previewModel } from '../src/features/catalog-preview/model'
import { mergePreview } from '../src/features/catalog-preview/mergeGroups'
import { createPreviewSource } from '../src/features/catalog-preview/source'
import { contractResponse } from '../src/features/documents/contract'
import type { ObservedDefinition } from '../src/features/documents/types'
import type { PreviewTask } from '../src/contracts/catalog-preview/1.4.0/types.generated'

const ids = Array.from({ length: 7 }, (_, i) => `${i + 1}b1b43ec-eb9c-468f-b4d4-ef7a1ce23e4e`)
const [project, taskId, first, second, directory, candidate, unknown] = ids as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]
function fixture(): PreviewTask {
  return {
    task_id: taskId,
    candidate_id: candidate,
    contract_version: '1.2.0',
    status: 'ready',
    snapshot_at: '2026-09-15T08:00:00Z',
    snapshot_sha256: 'hash',
    generation: 1,
    snapshot: {
      project_id: project,
      project_name: '项目',
      interfaces: [first, second].map((id, index) => ({
        interface_id: id,
        method: 'GET',
        path: `/orders/${index + 100}`,
        environments: [
          {
            environment_id: directory,
            environment_name: index === 0 ? 'UAT' : 'PROD',
            revision_id: id,
            definition: { member: id, unique: index },
          },
        ],
        recognized_path: {
          rule_version: 'path-v1',
          template: '/orders/{id}',
          parameters: [{ name: 'id', kind: 'integer', segment_index: 2 }],
        },
      })),
    },
    candidate: {
      nodes: [{ id: directory, name: '订单', description: '', parent: null }],
      assignments: [first, second].map((id) => ({
        interface_id: id,
        directory_id: directory,
        reason: `分类${id}`,
      })),
      merge_groups: [
        {
          representative_id: first,
          member_ids: [first, second],
          path_template: '/orders/{id}',
          reason: '<b>按订单ID查询</b>',
        },
      ],
    },
  }
}
const present = (task: PreviewTask) => mergePreview(task, previewModel(task))

describe('candidate merge groups', () => {
  it('folds a valid same-directory group without replacing member paths or definitions', () => {
    const task = fixture()
    const result = present(task)
    expect(result.fallback).toBe(false)
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]?.path).toBe('/orders/{id}')
    expect(result.cards[0]?.members.map((member) => member.item.path)).toEqual([
      '/orders/100',
      '/orders/101',
    ])
    expect(result.cards[0]?.members[1]?.item.environments[0]?.definition).toEqual({
      member: second,
      unique: 1,
    })
    expect(result.byMember.get(second)?.reason).toBe('<b>按订单ID查询</b>')
    expect(task.snapshot.interfaces).toHaveLength(2)
  })
  it('keeps ungrouped interfaces and old candidates visible', () => {
    const task = fixture()
    task.snapshot.interfaces.push({
      interface_id: unknown,
      method: 'POST',
      path: '/orders',
      environments: [],
    })
    task.candidate!.assignments.push({
      interface_id: unknown,
      directory_id: directory,
      reason: '创建订单',
    })
    expect(present(task).cards).toHaveLength(2)
    delete task.candidate!.merge_groups
    expect(present(task).cards).toHaveLength(3)
    expect(present(task).groupCount).toBe(0)
  })
  it.each([
    'duplicate',
    'overlap',
    'unknown',
    'representative',
    'directory',
    'method',
    'template',
    'assignment',
    'rejected',
    'empty-reason',
  ])('flattens all members for %s problems', (problem) => {
    const task = fixture()
    const group = task.candidate!.merge_groups![0]!
    if (problem === 'duplicate') group.member_ids.push(first)
    if (problem === 'overlap') task.candidate!.merge_groups!.push({ ...group })
    if (problem === 'unknown') group.member_ids.push(unknown)
    if (problem === 'representative') group.representative_id = unknown
    if (problem === 'directory') task.candidate!.assignments[1]!.directory_id = null
    if (problem === 'method') task.snapshot.interfaces[1]!.method = 'POST'
    if (problem === 'template') group.path_template = '/different/{id}'
    if (problem === 'assignment') task.candidate!.assignments.pop()
    if (problem === 'rejected') task.status = 'rejected'
    if (problem === 'empty-reason') group.reason = ''
    const result = present(task)
    expect(result.fallback).toBe(true)
    expect(result.cards.map((card) => card.members[0]?.item.interface_id)).toEqual([first, second])
    expect(result.groupCount).toBe(0)
  })
  it('accepts new optional group/hint fields and an older task through the pinned response schema', async () => {
    const task = fixture()
    const source = createPreviewSource(
      vi.fn().mockImplementation(async () => ({ published: false, task })),
    )
    const signal = new AbortController().signal
    expect(
      (await source.detail(project, taskId, signal)).task.candidate?.merge_groups,
    ).toHaveLength(1)
    task.contract_version = '1.0.0'
    delete task.candidate!.merge_groups
    for (const item of task.snapshot.interfaces) delete item.recognized_path
    expect((await source.detail(project, taskId, signal)).task.snapshot.interfaces).toHaveLength(2)
  })
})

describe('document parameter compatibility', () => {
  it('accepts both query and path fields without treating path parameters as query', () => {
    const definition: ObservedDefinition = {
      extractor_version: 'observed-http-1',
      method: 'GET',
      path: '/orders/{id}',
      request: {
        parameters: [
          { name: 'id', in: 'path', observed_schema: { type: 'string' } },
          { name: 'page', in: 'query', observed_schema: { type: 'integer' } },
        ],
        headers: [],
        body: { state: 'none', media_type: '' },
      },
      response: {
        status: 200,
        capture_state: 'captured',
        headers: [],
        body: { state: 'none', media_type: '' },
      },
      limitations: [],
    }
    const detail = contractResponse('InterfaceDetail', {
      interface_id: first,
      project_id: project,
      environment: { id: directory, name: 'UAT' },
      method: 'GET',
      path: '/orders/{id}',
      revision_id: second,
      state: 'observed',
      classification: 'unclassified',
      definition,
      origin_ingestion_id: unknown,
      created_at: '2026-09-15T08:00:00Z',
      pending_difference_count: 0,
    })
    expect(
      detail.definition.request.parameters
        .filter((parameter) => parameter.in === 'path')
        .map((parameter) => parameter.name),
    ).toEqual(['id'])
    expect(
      detail.definition.request.parameters
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => parameter.name),
    ).toEqual(['page'])
  })
})

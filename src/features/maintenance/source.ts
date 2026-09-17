import { api } from '@/api'
import {
  binding,
  maintenanceResponse,
  validatePublish,
  validateRestore,
  validateStart,
} from './contract'
import type { RebuildPort } from './ports'
import type { CatalogAttempt } from '@/features/catalog/change'
import type { ComparisonBasis } from './mapping'
import type {
  KnowledgeSnapshot,
  MaintenanceRun,
  FieldRef,
  SemanticAnnotation,
} from '@/contracts/maintenance/2.0.0/types.generated'

export const maintenancePath = (project: string) => `v1/projects/${encodeURIComponent(project)}`
const runPath = (project: string, run: string) =>
  `${maintenancePath(project)}/maintenance-runs/${encodeURIComponent(run)}`
function pagination(
  value: { page: number; limit: number; total: number; items: unknown[] },
  page: number,
  limit: number,
) {
  binding(
    value.page === page &&
      value.limit === limit &&
      value.total >= 0 &&
      value.items.length <= limit &&
      value.items.length <= value.total,
  )
}
export function createMaintenanceSource(request: typeof api.request) {
  return {
    async fact(project: string, id: string, signal: AbortSignal) {
      const value = maintenanceResponse(
        'fact',
        await request(`${maintenancePath(project)}/evidence/${encodeURIComponent(id)}`, {
          signal,
          cache: 'no-store',
        }),
      )
      binding(value.project_id === project && value.id === id)
      return value
    },
    async checkpoints(project: string, run: string, page: number, signal: AbortSignal) {
      const value = maintenanceResponse(
        'checkpoints',
        await request(
          `${runPath(project, run)}/checkpoints?${new URLSearchParams({ page: String(page), limit: '20' })}`,
          { signal, cache: 'no-store' },
        ),
      )
      pagination(value, page, 20)
      return value
    },
    async currentBasis(
      project: string,
      snapshot: KnowledgeSnapshot,
      run: MaintenanceRun,
      signal: AbortSignal,
    ): Promise<ComparisonBasis> {
      const root = `${maintenancePath(project)}/catalog`
      const current = maintenanceResponse(
        'official',
        await request(root, { signal, cache: 'no-store' }),
      )
      binding(current.project_id === project)
      const assignments = [] as {
        interface_id: string
        directory_id: string | null
        reason: string
      }[]
      let page = 1
      while (true) {
        const value = maintenanceResponse(
          'officialInterfaces',
          await request(
            `${root}/interfaces?${new URLSearchParams({ page: String(page), limit: '100', expected_generation: String(current.generation) })}`,
            { signal, cache: 'no-store' },
          ),
        )
        pagination(value, page, 100)
        binding(
          value.generation === current.generation &&
            (value.items.length > 0 || (page - 1) * 100 >= value.total),
        )
        assignments.push(
          ...value.items.map((item) => ({
            interface_id: item.interface_id,
            directory_id: item.directory_id === current.unclassified_id ? null : item.directory_id,
            reason: '',
          })),
        )
        if (page * 100 >= value.total) break
        page++
      }
      const targets = new Map<string, { interfaceId: string; environmentId: string }>()
      const field = (ref: FieldRef) =>
        targets.set(`${ref.interface_id}:${ref.environment_id}`, {
          interfaceId: ref.interface_id,
          environmentId: ref.environment_id,
        })
      const annotations = [
        ...snapshot.annotations.map((entry) => entry.annotation),
        ...(run.candidate?.plan.actions.flatMap((action) =>
          action.kind === 'upsert_annotation' ? [action.annotation] : [],
        ) ?? []),
      ]
      for (const annotation of annotations) {
        if (annotation.target.kind === 'field') field(annotation.target.field)
        else {
          const targetId = annotation.target.interface_id
          for (const env of snapshot.interfaces.find((item) => item.interface_id === targetId)
            ?.environments ?? [])
            targets.set(`${targetId}:${env.environment_id}`, {
              interfaceId: targetId,
              environmentId: env.environment_id,
            })
        }
        if (annotation.value.kind === 'parameter_relation') {
          field(annotation.value.source)
          field(annotation.value.target)
        }
      }
      const semantic = new Map<string, SemanticAnnotation>()
      const revisions: Record<string, string> = {}
      const queue = [...targets.values()]
      for (let i = 0; i < queue.length; i += 3) {
        const results = await Promise.all(
          queue.slice(i, i + 3).map(async (target) => {
            const value = maintenanceResponse(
              'knowledge',
              await request(
                `${maintenancePath(project)}/interfaces/${encodeURIComponent(target.interfaceId)}/knowledge?${new URLSearchParams({ environment_id: target.environmentId })}`,
                { signal, cache: 'no-store' },
              ),
            )
            binding(
              value.interface_id === target.interfaceId &&
                value.environment_id === target.environmentId &&
                value.generation === current.generation,
            )
            return value
          }),
        )
        for (const value of results) {
          revisions[`${value.interface_id}:${value.environment_id}`] = value.revision_id
          for (const entry of value.annotations) semantic.set(entry.annotation.id, entry)
        }
      }
      const last = maintenanceResponse(
        'versions',
        await request(`${maintenancePath(project)}/knowledge/versions?page=1&limit=20`, {
          signal,
          cache: 'no-store',
        }),
      )
      binding(last.generation === current.generation)
      return {
        current: true,
        generation: current.generation,
        revisions,
        catalog: {
          nodes: current.nodes
            .filter((node) => !node.system)
            .map((node) => ({
              id: node.id,
              parent: node.parent ?? null,
              name: node.name,
              description: node.description,
            })),
          assignments,
          merge_groups: current.merge_groups,
        },
        annotations: [...semantic.values()],
      }
    },
    async list(project: string, page: number, signal: AbortSignal) {
      const value = maintenanceResponse(
        'page',
        await request(
          `${maintenancePath(project)}/maintenance-runs?${new URLSearchParams({ page: String(page), limit: '20' })}`,
          { signal, cache: 'no-store' },
        ),
      )
      pagination(value, page, 20)
      binding(value.items.every((item) => item.project_id === project))
      return value
    },
    async run(project: string, id: string, signal: AbortSignal) {
      const value = maintenanceResponse(
        'run',
        await request(runPath(project, id), { signal, cache: 'no-store' }),
      )
      binding(value.project_id === project && value.id === id)
      return value
    },
    async snapshot(project: string, id: string, snapshotId: string, signal: AbortSignal) {
      const value = maintenanceResponse(
        'snapshot',
        await request(`${runPath(project, id)}/snapshot`, { signal, cache: 'no-store' }),
      )
      binding(value.project_id === project && value.id === snapshotId)
      return value
    },
    async knowledge(
      project: string,
      interfaceId: string,
      environmentId: string,
      signal: AbortSignal,
    ) {
      const value = maintenanceResponse(
        'knowledge',
        await request(
          `${maintenancePath(project)}/interfaces/${encodeURIComponent(interfaceId)}/knowledge?${new URLSearchParams({ environment_id: environmentId })}`,
          { signal, cache: 'no-store' },
        ),
      )
      binding(value.interface_id === interfaceId && value.environment_id === environmentId)
      return value
    },
    async versions(project: string, page: number, signal: AbortSignal) {
      const value = maintenanceResponse(
        'versions',
        await request(
          `${maintenancePath(project)}/knowledge/versions?${new URLSearchParams({ page: String(page), limit: '20' })}`,
          { signal, cache: 'no-store' },
        ),
      )
      pagination(value, page, 20)
      binding(value.items.every((item) => item.project_id === project))
      return value
    },
    async change(project: string, attempt: CatalogAttempt, signal: AbortSignal) {
      const base = {
        request_id: attempt.request_id,
        expected_generation: attempt.expected_generation,
      }
      const body = attempt.kind === 'publish' ? base : { ...base, version_id: attempt.version_id }
      binding(
        attempt.expected_generation >= 0 &&
          (attempt.kind === 'publish' ? validatePublish(body) : validateRestore(body)),
      )
      const url =
        attempt.kind === 'publish'
          ? `${runPath(project, attempt.task_id)}/publish`
          : `${maintenancePath(project)}/knowledge/restore`
      const value = maintenanceResponse(
        'activation',
        await request(url, { method: 'POST', json: body, signal, cache: 'no-store' }),
      )
      binding(
        value.request_id === attempt.request_id &&
          value.generation >= attempt.expected_generation &&
          (attempt.kind === 'publish'
            ? !value.changed || !!value.version_id
            : (value.version_id ?? null) === attempt.version_id),
      )
      return value
    },
    async observation(project: string, id: string, signal: AbortSignal) {
      const value = maintenanceResponse(
        'observation',
        await request(
          `${maintenancePath(project)}/capture-observations/${encodeURIComponent(id)}`,
          { signal, cache: 'no-store' },
        ),
      )
      binding(value.project_id === project && value.id === id)
      return value
    },
  }
}
export const maintenanceSource = createMaintenanceSource(api.request)
export type MaintenanceSource = ReturnType<typeof createMaintenanceSource>
export function createRebuildPort(request: typeof api.request): RebuildPort {
  return {
    async start(attempt, signal) {
      const body = { request_id: attempt.requestKey }
      binding(validateStart(body))
      const value = maintenanceResponse(
        'run',
        await request(`${maintenancePath(attempt.projectId)}/maintenance-runs`, {
          method: 'POST',
          json: body,
          signal,
          cache: 'no-store',
        }),
      )
      binding(value.project_id === attempt.projectId)
      return { projectId: value.project_id, taskId: value.id }
    },
  }
}
export const rebuildPort = createRebuildPort(api.request)

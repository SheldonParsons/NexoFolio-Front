import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { api, ApiError } from '@/api'
import officialSchema from '@/contracts/catalog-preview/1.4.0/official.schema.json'
import interfacesSchema from '@/contracts/catalog-preview/1.4.0/official-interfaces.schema.json'
import versionsSchema from '@/contracts/catalog-preview/1.4.0/versions.schema.json'
import publishSchema from '@/contracts/catalog-preview/1.4.0/publish.schema.json'
import restoreSchema from '@/contracts/catalog-preview/1.4.0/restore.schema.json'
import activationSchema from '@/contracts/catalog-preview/1.4.0/activation.schema.json'
import type {
  OfficialCatalog,
  OfficialInterfacePage,
  CatalogVersionPage,
  PublishCatalog,
  RestoreCatalog,
  CatalogActivation,
} from '@/contracts/catalog-preview/1.4.0/types.generated'
import type { CatalogSource, CatalogState, LiveCatalogInterface } from './types'

const ajv = new Ajv2020({ strict: true, allErrors: false })
addFormats(ajv)
ajv.addFormat('uint', {
  type: 'number',
  validate: (n: number) => Number.isSafeInteger(n) && n >= 0,
})
ajv.addFormat('uint32', {
  type: 'number',
  validate: (n: number) => Number.isInteger(n) && n >= 0 && n <= 4294967295,
})
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger })
const valid = {
  current: ajv.compile<OfficialCatalog>(officialSchema),
  interfaces: ajv.compile<OfficialInterfacePage>(interfacesSchema),
  versions: ajv.compile<CatalogVersionPage>(versionsSchema),
  publish: ajv.compile<PublishCatalog>(publishSchema),
  restore: ajv.compile<RestoreCatalog>(restoreSchema),
  activation: ajv.compile<CatalogActivation>(activationSchema),
}
const path = (projectId: string) => `v1/projects/${encodeURIComponent(projectId)}/catalog`
function mismatch(): never {
  throw new ApiError('目录数据与当前项目、版本或接口契约不匹配，请刷新。', 'invalid-response')
}
function checkPage(
  value: { page: number; limit: number; total: number; items: unknown[] },
  page: number,
  limit: number,
) {
  if (
    value.page !== page ||
    value.limit !== limit ||
    value.total < 0 ||
    value.items.length > limit ||
    value.items.length > value.total ||
    (!value.items.length && (page - 1) * limit < value.total)
  )
    mismatch()
}
export function createCatalogSource(request: typeof api.request): CatalogSource {
  return {
    async current(projectId, signal) {
      const value = await request<unknown>(path(projectId), { signal, cache: 'no-store' })
      if (
        !valid.current(value) ||
        value.project_id !== projectId ||
        value.generation < 0 ||
        value.total_interfaces < 0 ||
        new Set(value.nodes.map((node) => node.id)).size !== value.nodes.length ||
        value.nodes.some((node) => node.direct_interfaces < 0)
      )
        mismatch()
      const system = value.nodes.find((node) => node.id === value.unclassified_id)
      if (!system?.system || !system.locked || system.parent != null || system.name !== '待分类')
        mismatch()
      return {
        projectId: value.project_id,
        name: '接口目录',
        generation: value.generation,
        versionId: value.version_id ?? null,
        sourceTaskId: value.source_task_id ?? null,
        sourceRunId: value.source_run_id ?? null,
        unclassifiedId: value.unclassified_id,
        total: value.total_interfaces,
        groups: value.merge_groups,
        nodes: value.nodes.map((node) => ({
          id: node.id,
          parent: node.parent ?? null,
          name: node.name,
          description: node.description,
          count: node.direct_interfaces,
          system: node.system,
        })),
      }
    },
    async interfaces(projectId, directoryId, page, generation, signal) {
      const query = new URLSearchParams({
        directory_id: directoryId,
        page: String(page),
        limit: '100',
        expected_generation: String(generation),
      })
      const value = await request<unknown>(`${path(projectId)}/interfaces?${query}`, {
        signal,
        cache: 'no-store',
      })
      if (
        !valid.interfaces(value) ||
        value.generation !== generation ||
        value.items.some((item) => item.directory_id !== directoryId) ||
        new Set(value.items.map((item) => item.interface_id)).size !== value.items.length
      )
        mismatch()
      checkPage(value, page, 100)
      return {
        page: value.page,
        limit: value.limit,
        total: value.total,
        generation: value.generation,
        items: value.items.map((item) => ({
          id: item.interface_id,
          method: item.method,
          path: item.path,
          environments: item.environments.map((env) => ({
            id: env.environment_id,
            name: env.environment_name,
            revisionId: env.revision_id,
          })),
        })),
      }
    },
    async versions(projectId, page, signal) {
      const query = new URLSearchParams({ page: String(page), limit: '20' })
      const value = await request<unknown>(`${path(projectId)}/versions?${query}`, {
        signal,
        cache: 'no-store',
      })
      if (!valid.versions(value) || value.generation < 0) mismatch()
      checkPage(value, page, 20)
      return {
        page: value.page,
        limit: value.limit,
        total: value.total,
        items: value.items.map((item) => ({
          id: item.version_id,
          taskId: item.source_task_id ?? null,
          runId: item.source_run_id ?? null,
          createdAt: item.created_at,
        })),
      }
    },
    async change(projectId, attempt, signal) {
      const base = {
        expected_generation: attempt.expected_generation,
        request_id: attempt.request_id,
      }
      const body =
        attempt.kind === 'publish'
          ? { ...base, task_id: attempt.task_id }
          : { ...base, version_id: attempt.version_id }
      if (
        attempt.expected_generation < 0 ||
        !(attempt.kind === 'publish' ? valid.publish(body) : valid.restore(body))
      )
        mismatch()
      const value = await request<unknown>(`${path(projectId)}/${attempt.kind}`, {
        method: 'POST',
        json: body,
        signal,
        cache: 'no-store',
      })
      if (
        !valid.activation(value) ||
        value.request_id !== attempt.request_id ||
        value.generation < attempt.expected_generation ||
        (attempt.kind === 'restore' && (value.version_id ?? null) !== attempt.version_id) ||
        (attempt.kind === 'publish' && !value.version_id)
      )
        mismatch()
      return value
    },
  }
}
export const catalogSource = createCatalogSource(api.request)

// Temporary environment view over the shared project directory. Read every page,
// rather than filtering only the currently expanded/loaded branch.
export async function readCatalogForEnvironment(
  projectId: string,
  environmentId: string,
  catalog: CatalogState,
  signal: AbortSignal,
) {
  const matches = new Map<string, { directoryId: string; item: LiveCatalogInterface }>()
  let page = 1
  while (true) {
    const query = new URLSearchParams({
      page: String(page),
      limit: '100',
      expected_generation: String(catalog.generation),
    })
    const value = await api.request<unknown>(`${path(projectId)}/interfaces?${query}`, {
      signal,
      cache: 'no-store',
    })
    if (!valid.interfaces(value) || value.generation !== catalog.generation) mismatch()
    checkPage(value, page, 100)
    for (const item of value.items) {
      const environments = item.environments.filter((env) => env.environment_id === environmentId)
      if (!environments.length) continue
      if (!catalog.nodes.some((node) => node.id === item.directory_id)) mismatch()
      matches.set(item.interface_id, {
        directoryId: item.directory_id,
        item: {
          id: item.interface_id,
          method: item.method,
          path: item.path,
          environments: environments.map((env) => ({
            id: env.environment_id,
            name: env.environment_name,
            revisionId: env.revision_id,
          })),
        },
      })
    }
    if (page * value.limit >= value.total) break
    page++
  }
  const itemsByDirectory: Record<string, LiveCatalogInterface[]> = {}
  const keep = new Set([catalog.unclassifiedId])
  const nodes = new Map(catalog.nodes.map((node) => [node.id, node]))
  for (const { directoryId, item } of matches.values()) {
    ;(itemsByDirectory[directoryId] ??= []).push(item)
    let id: string | null = directoryId
    const visited = new Set<string>()
    while (id && !visited.has(id)) {
      visited.add(id)
      keep.add(id)
      id = nodes.get(id)?.parent ?? null
    }
  }
  return {
    catalog: {
      ...catalog,
      total: matches.size,
      nodes: catalog.nodes
        .filter((node) => keep.has(node.id))
        .map((node) => ({ ...node, count: itemsByDirectory[node.id]?.length ?? 0 })),
    },
    itemsByDirectory,
  }
}

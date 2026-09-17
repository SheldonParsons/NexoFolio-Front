import { api, ApiError } from '@/api'
import { liveDocumentSource } from './source'
import { contractResponse, requireBinding } from './contract'
import { maintenanceSource } from '@/features/maintenance/source'
import { maintenanceResponse } from '@/features/maintenance/contract'
import type { CatalogState, LiveCatalogInterface } from '@/features/catalog/types'
import type { InterfaceDetail, ObservationCard, ObservationDetail } from './types'
import type { ObservationAssessment } from '@/contracts/documents/2.2.0/types.generated'
import type { EvidenceFact, CaptureObservation } from '@/contracts/capture/1.2.0/types.generated'
import type { InterfaceKnowledge, SemanticAnnotation, FieldRef } from '@/contracts/maintenance/2.0.0/types.generated'

export interface ReportSelection {
  item: LiveCatalogInterface
  directoryId: string
  environmentId: string
  catalog: CatalogState
}
export interface EnvironmentReport {
  id: string
  name: string
  definition?: InterfaceDetail
  knowledge?: InterfaceKnowledge
  assessments?: ObservationAssessment[]
  observations?: ObservationDetail[]
  observationSummaries?: ObservationCard[]
  facts?: EvidenceFact[]
  samples?: CaptureObservation[]
  errors: string[]
}
export interface InterfaceReport {
  selection: ReportSelection
  environments: EnvironmentReport[]
  candidates?: unknown[]
  errors: string[]
}

export function reportError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) return '暂无访问权限。'
    if (error.status === 404) return '资料不存在或已被移除。'
  }
  return error instanceof Error ? error.message : '读取失败，请重试。'
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
// Attribute evidence using structured field references only, never URLs or temporal proximity.
export function evidenceBelongs(value: unknown, project: string, id: string, environment: string): boolean {
  if (Array.isArray(value)) return value.some(item => evidenceBelongs(item, project, id, environment))
  const ref = object(value)
  if (!ref) return false
  const hasField = ['interface_id', 'environment_id', 'location', 'path'].every(key => typeof ref[key] === 'string')
  if (hasField) {
    const observed = object(ref.observation)
    const validObservation = !ref.revision_id && observed && observed.project_id === project &&
      typeof observed.ingestion_id === 'string' &&
      ['interface_id', 'environment_id', 'location', 'path'].every(key => observed[key] === ref[key])
    const valid = typeof ref.revision_id === 'string' || validObservation
    // An invalid outer observation reference must not be accepted through its nested fields.
    return !!valid && ref.interface_id === id && ref.environment_id === environment
  }
  return Object.values(ref).some(item => evidenceBelongs(item, project, id, environment))
}
function annotationBelongs(entry: SemanticAnnotation, id: string, environments: Set<string>) {
  const target = entry.annotation.target
  const fieldMatches = (field: FieldRef) => field.interface_id === id && environments.has(field.environment_id)
  const targetMatches = target.kind === 'field' ? fieldMatches(target.field) : target.interface_id === id &&
    (!entry.basis.length || entry.basis.some(base => base.interface_id === id && environments.has(base.environment_id)))
  const value = entry.annotation.value
  return targetMatches || (value.kind === 'parameter_relation' && (fieldMatches(value.source) || fieldMatches(value.target)))
}
async function allPages<T>(read: (page: number) => Promise<{ items: T[]; page: number; limit: number; total: number }>, signal: AbortSignal) {
  const items: T[] = []
  for (let page = 1; ; page++) {
    signal.throwIfAborted()
    const result = await read(page)
    requireBinding(result.page === page && result.limit > 0 && (result.items.length > 0 || (page - 1) * result.limit >= result.total))
    items.push(...result.items)
    if (page * result.limit >= result.total) return items
  }
}
async function pooled<T, R>(items: T[], read: (item: T) => Promise<R>, signal: AbortSignal): Promise<R[]> {
  let cursor = 0
  const result: R[] = new Array(items.length)
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, async () => {
    while (cursor < items.length) {
      signal.throwIfAborted()
      const index = cursor++
      result[index] = await read(items[index]!)
    }
  }))
  return result
}

export async function loadInterfaceReport(
  selection: ReportSelection,
  signal: AbortSignal,
  update: (report: InterfaceReport, progress: string) => void,
) {
  const project = selection.catalog.projectId
  const id = selection.item.id
  const path = `v1/projects/${encodeURIComponent(project)}`
  const reports: EnvironmentReport[] = selection.item.environments
    .filter(env => !selection.environmentId || env.id === selection.environmentId)
    .map(env => ({ id: env.id, name: env.name, errors: [] }))
  const report: InterfaceReport = { selection, environments: reports, errors: [] }
  const publish = (progress: string) => {
    signal.throwIfAborted()
    update({ ...report, environments: reports.map(env => ({ ...env, errors: [...env.errors] })), errors: [...report.errors] }, progress)
  }
  async function optional<T>(label: string, read: () => Promise<T>, errors: string[]): Promise<T | undefined> {
    try { return await read() } catch (error) {
      signal.throwIfAborted()
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) throw error
      errors.push(`${label}：${reportError(error)}`)
      return undefined
    }
  }
  if (!reports.length) report.errors.push('该接口当前没有可读取的环境定义。')
  publish('正在读取接口定义与衍生知识…')
  for (const env of reports) {
    env.definition = await optional('接口定义', () => liveDocumentSource.definition(project, env.id, id, signal), env.errors)
    env.knowledge = await optional('已发布知识', () => maintenanceSource.knowledge(project, id, env.id, signal), env.errors)
    if (env.definition && env.knowledge && env.definition.revision_id !== env.knowledge.revision_id) {
      env.errors.push('读取期间定义修订发生变化，定义与知识并非同一快照，请重新加载。')
    }
    publish(`正在读取 ${env.name} 的结构判定与采集记录…`)
    env.assessments = await optional('结构判定', () => allPages(async page => {
      const query = new URLSearchParams({ environment_id: env.id, page: String(page), limit: '100' })
      const value = contractResponse('ObservationAssessmentPage', await api.request(`${path}/interfaces/${encodeURIComponent(id)}/assessments?${query}`, { signal, cache: 'no-store' }))
      requireBinding(value.items.every(item => item.project_id === project && item.interface_id === id && item.environment_id === env.id))
      return value
    }, signal), env.errors)
    const cards = await optional('采集历史列表', () => allPages(page => liveDocumentSource.observations(project, env.id, id, page, signal), signal), env.errors)
    if (cards) {
      env.observationSummaries = cards
      const ingestionIds = new Set(cards.map(card => card.ingestion_id))
      if (env.definition) ingestionIds.add(env.definition.origin_ingestion_id)
      const records = await pooled([...ingestionIds], ingestion => optional(`采集记录 ${ingestion}`, () => liveDocumentSource.observation(project, env.id, id, ingestion, signal), env.errors), signal)
      env.observations = records.filter((item): item is ObservationDetail => !!item)
    }
    publish(`正在读取 ${env.name} 的字段证据与关联样本…`)
    const facts = await optional('衍生证据列表', () => allPages(async page => {
      const query = new URLSearchParams({ environment_id: env.id, page: String(page), limit: '100' })
      const value = maintenanceResponse('facts', await api.request(`${path}/evidence?${query}`, { signal, cache: 'no-store' }))
      requireBinding(value.items.every(item => item.project_id === project && item.environment_id === env.id))
      return value
    }, signal), env.errors)
    const byId = new Map((facts ?? []).filter(fact => evidenceBelongs(fact.subject, project, id, env.id)).map(fact => [fact.id, fact]))
    const references = env.knowledge?.annotations.flatMap(entry => entry.annotation.evidence) ?? []
    for (const ref of references.filter(ref => ref.kind === 'fact')) {
      if (byId.has(ref.id)) continue
      const fact = await optional(`引用证据 ${ref.id}`, () => maintenanceSource.fact(project, ref.id, signal), env.errors)
      if (fact) byId.set(fact.id, fact)
    }
    if (facts) env.facts = [...byId.values()]
    else if (byId.size) env.facts = [...byId.values()]
    const sampleIds = new Set([...byId.values()].flatMap(fact => fact.samples))
    for (const ref of references) if (ref.kind === 'observation') sampleIds.add(ref.id)
    const samples = await pooled([...sampleIds], sample => optional(`证据样本 ${sample}`, () => maintenanceSource.observation(project, sample, signal), env.errors), signal)
    env.samples = samples.filter((item): item is CaptureObservation => !!item)
    publish(`已读取 ${env.name}，正在继续整理资料…`)
  }
  publish('正在读取未发布候选…')
  const runs = await optional('候选版本列表', () => allPages(page => maintenanceSource.list(project, page, signal), signal), report.errors)
  if (runs) {
    const environments = new Set(reports.map(env => env.id))
    const candidates = await pooled(runs.filter(run => run.candidate_available && !run.currently_published), async summary => {
      return optional(`候选 ${summary.id}`, async () => {
        const run = await maintenanceSource.run(project, summary.id, signal)
        if (!run.candidate || run.currently_published) return null
        const candidate = run.candidate
        const annotations = candidate.annotations.filter(entry => annotationBelongs(entry, id, environments))
        const assignments = candidate.catalog.assignments.filter(entry => entry.interface_id === id)
        const groups = candidate.catalog.merge_groups?.filter(group => group.member_ids.includes(id) || group.representative_id === id) ?? []
        const relatedAnnotationIds = new Set([
          ...annotations.map(entry => entry.annotation.id),
          ...reports.flatMap(env => env.knowledge?.annotations.map(entry => entry.annotation.id) ?? []),
        ])
        const directoryIds = new Set(assignments.flatMap(entry => entry.directory_id ? [entry.directory_id] : []))
        directoryIds.add(selection.directoryId)
        const actions = candidate.plan.actions.filter(action => {
          switch (action.kind) {
            case 'assign_interface': return action.interface_id === id
            case 'upsert_annotation': return annotationBelongs({ annotation: action.annotation, basis: [], source_run_id: run.id, stale: false }, id, environments)
            case 'retract_annotation': return relatedAnnotationIds.has(action.annotation_id)
            case 'upsert_merge_group': return action.group.representative_id === id || action.group.member_ids.includes(id)
            case 'remove_merge_group': return action.representative_id === id || selection.catalog.groups.some(group => group.representative_id === action.representative_id && group.member_ids.includes(id))
            case 'set_directory': return directoryIds.has(action.node.id)
            case 'remove_directory': return directoryIds.has(action.directory_id)
            case 'replace_catalog': return false
          }
        })
        if (!annotations.length && !assignments.length && !groups.length && !actions.length) return null
        const snapshot = await maintenanceSource.snapshot(project, run.id, run.snapshot_id, signal)
        const frozenFactIds = new Set(annotations.flatMap(entry => entry.annotation.evidence.filter(ref => ref.kind === 'fact').map(ref => ref.id)))
        return {
          run_id: run.id, status: run.status, phase: run.phase, created_at: run.created_at,
          currently_published: false, snapshot_id: run.snapshot_id,
          annotations, assignments, merge_groups: groups,
          plan: { strategy: candidate.plan.strategy, reason: candidate.plan.reason, expected_benefit: candidate.plan.expected_benefit, actions,
            catalog_replacements: candidate.plan.actions.filter(action => action.kind === 'replace_catalog').map(action => ({ kind: action.kind, reason: action.reason, evidence: action.evidence, assignments, merge_groups: groups })) },
          directory_nodes: candidate.catalog.nodes.filter(node => assignments.some(a => a.directory_id === node.id)),
          project_review: candidate.review, project_coverage: candidate.coverage, project_issues: candidate.issues,
          frozen_basis: {
            base_generation: snapshot.base_generation,
            interfaces: snapshot.interfaces.filter(item => item.interface_id === id).map(item => ({ ...item, environments: item.environments.filter(env => environments.has(env.environment_id)) })),
            fields: snapshot.fields.filter(field => field.reference.interface_id === id && environments.has(field.reference.environment_id)),
            facts: snapshot.facts.filter(fact => frozenFactIds.has(fact.id) || [...environments].some(env => evidenceBelongs(fact.subject, project, id, env))),
            annotations: snapshot.annotations.filter(entry => annotationBelongs(entry, id, environments)),
          },
        }
      }, report.errors)
    }, signal)
    report.candidates = candidates.filter(item => item != null)
  }
  publish('')
  return report
}

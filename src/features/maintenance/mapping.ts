import type {
  AnnotationDraft,
  DirectoryCandidate,
  InterfaceKnowledge,
  KnowledgeSnapshot,
  MaintenanceRun,
  SemanticAnnotation,
  Verification,
  KnowledgeEvidenceRef,
} from '@/contracts/maintenance/2.0.0/types.generated'
import type {
  CandidateChange,
  DiffValue,
  EvidenceRef,
  KnowledgeBasis,
  MaintenanceCandidate,
  SemanticDocument,
  SemanticField,
  TaskProgress,
} from './models'

export const verification = (value: Verification): KnowledgeBasis =>
  value === 'needs_review' ? 'review-needed' : value
export function evidenceRefs(
  projectId: string,
  refs: KnowledgeEvidenceRef[],
  runId?: string,
): EvidenceRef[] {
  return refs.map((ref) => ({
    projectId,
    runId,
    id: ref.id,
    label: `${ref.kind} · ${ref.id}`,
    kind: ref.kind === 'image' ? 'screenshot' : 'text',
    resource: ['interface', 'field', 'fact', 'image', 'directory', 'summary'].includes(ref.kind)
      ? (ref.kind as EvidenceRef['resource'])
      : 'unknown',
  }))
}
export function taskProgress(run: MaintenanceRun): TaskProgress {
  const c = run.coverage
  return {
    id: run.id,
    projectId: run.project_id,
    state: run.status === 'pending' ? 'queued' : run.status,
    phase: run.phase,
    segments: { completed: c.completed_segments, total: c.total_segments },
    snapshot: {
      id: run.snapshot_id,
      createdAt: run.created_at,
      interfaceCount: c.total_interfaces,
      fieldCount: c.total_fields,
      evidence: [
        {
          id: run.snapshot_id,
          projectId: run.project_id,
          label: '本次完整快照',
          kind: 'text',
          resource: 'snapshot',
        },
      ],
    },
    coverage: {
      total: c.total_fields,
      reviewed: c.reviewed_fields,
      missing: Math.max(0, c.total_fields - c.reviewed_fields),
      failed: c.complete ? 0 : null,
      complete: c.complete,
    },
    shards: [],
    readback: {
      state: run.status === 'ready' && c.complete ? 'complete' : 'unknown',
      description: `服务记录了 ${run.read_count} 次回读、${run.model_calls} 次模型调用；不据此推断未提供的逐项结果。`,
      evidence: [],
    },
    strategy: run.candidate
      ? {
          label: { keep: '保持现状', insert: '增量整理', partial: '局部重构', full: '全量重构' }[
            run.candidate.plan.strategy
          ],
          reason: `${run.candidate.plan.reason}\n预期收益：${run.candidate.plan.expected_benefit}`,
        }
      : null,
    problems: [...(run.error_code ? [run.error_code] : []), ...(run.candidate?.issues ?? [])],
  }
}
export function semanticDocument(projectId: string, data: InterfaceKnowledge): SemanticDocument {
  return {
    projectId,
    interfaceId: data.interface_id,
    environmentId: data.environment_id,
    fields: data.annotations.map((entry): SemanticField => {
      const annotation = entry.annotation
      const refs = evidenceRefs(projectId, annotation.evidence, entry.source_run_id)
      const basis = verification(annotation.verification)
      const field: SemanticField = {
        id: annotation.id,
        basis,
        note: annotation.note,
        path:
          annotation.target.kind === 'field'
            ? `${annotation.target.field.location} · ${annotation.target.field.path}`
            : '接口说明',
        boundRevision:
          annotation.target.kind === 'field'
            ? annotation.target.field.revision_id
            : (entry.basis.find((item) => item.environment_id === data.environment_id)
                ?.revision_id ?? null),
        currentRevision: data.revision_id,
        stale: entry.stale,
        description: null,
        sources: [],
        enumeration: { scope: 'unknown', scopeDescription: '', evidence: [], values: [] },
      }
      const value = annotation.value
      if (value.kind === 'description')
        field.description = { value: value.text, basis, evidence: refs }
      if (value.kind === 'parameter_relation')
        field.sources = [
          {
            fieldPath: `${value.source.interface_id} · ${value.source.location} · ${value.source.path}`,
            relation: {
              value: `目标：${value.target.interface_id} · ${value.target.location} · ${value.target.path}\n转换：${value.transform}\n条件：${JSON.stringify(value.conditions, null, 2)}`,
              basis,
              evidence: refs,
            },
          },
        ]
      if (value.kind === 'enum')
        field.enumeration = {
          scope: value.complete ? 'complete' : 'observed-only',
          scopeDescription: JSON.stringify(value.scope, null, 2) ?? '未提供观察范围',
          evidence: refs,
          values: value.entries.map((item) => ({
            sample:
              item.state === 'omitted'
                ? { kind: 'missing' }
                : item.state === 'unknown'
                  ? { kind: 'unknown' }
                  : item.value === null
                    ? { kind: 'null' }
                    : { kind: 'value', value: item.value },
            label: item.label == null ? null : { value: item.label, basis, evidence: refs },
            count: null,
            evidence: refs,
          })),
        }
      return field
    }),
  }
}
export interface ComparisonBasis {
  catalog: DirectoryCandidate
  annotations: SemanticAnnotation[]
  generation: number
  current: boolean
  revisions?: Record<string, string>
}
export function candidateChanges(
  run: MaintenanceRun,
  snapshot: KnowledgeSnapshot | null,
  comparison: ComparisonBasis | null = null,
): MaintenanceCandidate {
  const plan = run.candidate?.plan
  const basis =
    comparison ??
    (snapshot
      ? {
          catalog: snapshot.catalog,
          annotations: snapshot.annotations,
          generation: snapshot.base_generation,
          current: false,
        }
      : null)
  let catalog = structuredClone(basis?.catalog)
  const annotations = new Map(
    basis?.annotations.map((entry) => [entry.annotation.id, entry.annotation]) ?? [],
  )
  const diff = (value: unknown): DiffValue =>
    value === undefined ? { present: false, known: !!basis } : { present: true, value }
  const label = (id: string) => {
    const item = snapshot?.interfaces.find((item) => item.interface_id === id)
    return item ? `${item.method} ${item.path}` : id
  }
  const changes: CandidateChange[] = []
  function add(
    index: number,
    kind: CandidateChange['kind'],
    target: string,
    before: unknown,
    after: unknown,
    reason: string,
    refs: KnowledgeEvidenceRef[],
    annotation?: AnnotationDraft,
  ) {
    const ref = annotation?.target.kind === 'field' ? annotation.target.field : null
    const dependencies = [
      ...(ref ? [ref] : []),
      ...(annotation?.value.kind === 'parameter_relation'
        ? [annotation.value.source, annotation.value.target]
        : []),
    ]
    const versions = dependencies.map(
      (field) => comparison?.revisions?.[`${field.interface_id}:${field.environment_id}`],
    )
    const stale = dependencies.some(
      (field, index) => versions[index] !== undefined && versions[index] !== field.revision_id,
    )
      ? true
      : dependencies.length && versions.every((value) => value !== undefined)
        ? false
        : undefined
    changes.push({
      id: `${index}:${kind}`,
      kind,
      target,
      before: diff(before),
      after: {
        present: after !== undefined,
        ...(after !== undefined ? { value: after } : {}),
      } as DiffValue,
      basis: annotation ? verification(annotation.verification) : 'inferred',
      reason,
      evidence: evidenceRefs(run.project_id, refs, run.id),
      stale,
      boundRevision: ref?.revision_id ?? null,
      currentRevision:
        ref && versions.every((value) => value !== undefined)
          ? (comparison?.revisions?.[`${ref.interface_id}:${ref.environment_id}`] ?? null)
          : null,
    })
  }
  for (const [index, action] of (plan?.actions ?? []).entries()) {
    if (action.kind === 'upsert_annotation') {
      const old = annotations.get(action.annotation.id)
      const v = action.annotation.value
      const target =
        action.annotation.target.kind === 'field'
          ? `${label(action.annotation.target.field.interface_id)} · ${action.annotation.target.field.location} · ${action.annotation.target.field.path}`
          : label(action.annotation.target.interface_id)
      if (v.kind === 'enum') {
        add(
          index,
          'enum-label',
          target,
          old?.value.kind === 'enum' ? old.value.entries : old?.value,
          v.entries,
          action.reason,
          action.annotation.evidence,
          action.annotation,
        )
        add(
          index,
          'enum-scope',
          target,
          old?.value.kind === 'enum'
            ? { complete: old.value.complete, scope: old.value.scope }
            : old?.value,
          { complete: v.complete, scope: v.scope },
          action.reason,
          action.annotation.evidence,
          action.annotation,
        )
      } else
        add(
          index,
          v.kind === 'description' ? 'description' : 'source-relation',
          target,
          old?.value,
          v,
          action.reason,
          action.annotation.evidence,
          action.annotation,
        )
      annotations.set(action.annotation.id, action.annotation)
      continue
    }
    if (action.kind === 'retract_annotation') {
      const old = annotations.get(action.annotation_id)
      add(
        index,
        old?.value.kind === 'enum'
          ? 'enum-label'
          : old?.value.kind === 'parameter_relation'
            ? 'source-relation'
            : 'description',
        `撤回语义 ${action.annotation_id}`,
        old?.value,
        undefined,
        action.reason,
        action.evidence,
        old,
      )
      annotations.delete(action.annotation_id)
      continue
    }
    if (action.kind === 'set_directory') {
      add(
        index,
        'directory',
        action.node.name,
        catalog?.nodes.find((node) => node.id === action.node.id),
        action.node,
        action.reason,
        action.evidence,
      )
      if (catalog)
        catalog.nodes = [...catalog.nodes.filter((node) => node.id !== action.node.id), action.node]
    }
    if (action.kind === 'remove_directory') {
      add(
        index,
        'directory',
        `删除目录 ${action.directory_id}`,
        catalog?.nodes.find((node) => node.id === action.directory_id),
        undefined,
        action.reason,
        action.evidence,
      )
      if (catalog) catalog.nodes = catalog.nodes.filter((node) => node.id !== action.directory_id)
    }
    if (action.kind === 'assign_interface') {
      const previous = catalog?.assignments.find(
        (entry) => entry.interface_id === action.interface_id,
      )
      const next = {
        interface_id: action.interface_id,
        directory_id: action.directory_id ?? null,
        reason: action.reason,
      }
      add(
        index,
        'directory',
        label(action.interface_id),
        previous
          ? { interface_id: previous.interface_id, directory_id: previous.directory_id ?? null }
          : undefined,
        { interface_id: next.interface_id, directory_id: next.directory_id },
        action.reason,
        action.evidence,
      )
      if (catalog)
        catalog.assignments = [
          ...catalog.assignments.filter((entry) => entry.interface_id !== action.interface_id),
          next,
        ]
    }
    if (action.kind === 'replace_catalog') {
      add(
        index,
        'directory',
        '替换目录结构',
        catalog && comparison?.current
          ? {
              ...catalog,
              assignments: catalog.assignments.map((entry) => ({
                interface_id: entry.interface_id,
                directory_id: entry.directory_id ?? null,
              })),
            }
          : catalog,
        action.candidate,
        action.reason,
        action.evidence,
      )
      catalog = structuredClone(action.candidate)
    }
    if (action.kind === 'upsert_merge_group') {
      add(
        index,
        'directory',
        action.group.path_template,
        catalog?.merge_groups?.find(
          (group) => group.representative_id === action.group.representative_id,
        ),
        action.group,
        action.reason,
        action.evidence,
      )
      if (catalog)
        catalog.merge_groups = [
          ...(catalog.merge_groups ?? []).filter(
            (group) => group.representative_id !== action.group.representative_id,
          ),
          action.group,
        ]
    }
    if (action.kind === 'remove_merge_group') {
      add(
        index,
        'directory',
        `撤回合并组 ${action.representative_id}`,
        catalog?.merge_groups?.find(
          (group) => group.representative_id === action.representative_id,
        ),
        undefined,
        action.reason,
        action.evidence,
      )
      if (catalog)
        catalog.merge_groups = catalog.merge_groups?.filter(
          (group) => group.representative_id !== action.representative_id,
        )
    }
  }
  return {
    id: run.id,
    taskId: run.id,
    projectId: run.project_id,
    baseGeneration: run.base_generation,
    changes,
    problems: run.candidate?.issues ?? [],
  }
}

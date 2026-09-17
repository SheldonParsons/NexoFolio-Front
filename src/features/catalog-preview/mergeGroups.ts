import type {
  InterfaceMergeGroup,
  PreviewTask,
} from '@/contracts/catalog-preview/1.4.0/types.generated'
import type { previewModel } from './model'

type Model = ReturnType<typeof previewModel>
export type PreviewEntry = Model['entries'][number]
export interface PreviewCard {
  key: string
  method: string
  path: string
  group: InterfaceMergeGroup | null
  members: PreviewEntry[]
}

function covers(template: string, path: string) {
  if (
    !template.startsWith('/') ||
    new TextEncoder().encode(template).length > 4096 ||
    /[?#\x00-\x1f\x7f]/.test(template)
  )
    return false
  const parts = template.split('/')
  const actual = path.split('/')
  return (
    parts.length === actual.length &&
    parts.every((part, index) =>
      part.startsWith('{') && part.endsWith('}')
        ? /^\{[a-zA-Z0-9_]+\}$/.test(part) && !!actual[index]
        : part === actual[index],
    )
  )
}

/** Any ambiguous group disables all folding, keeping every original snapshot entry visible. */
export function mergePreview(task: PreviewTask, model: Model) {
  const groups = task.candidate?.merge_groups ?? []
  const problems = new Set<string>()
  const entries = new Map(model.entries.map((entry) => [entry.item.interface_id, entry]))
  const byMember = new Map<string, InterfaceMergeGroup>()
  if (groups.length) {
    if (model.flat || task.status !== 'ready' || task.review?.issues.length)
      problems.add('候选未通过检查，保留原始接口。')
    if (entries.size !== model.entries.length) problems.add('快照接口 ID 重复。')
    if (
      task.candidate?.assignments.length !== model.entries.length ||
      model.entries.some(
        (entry) =>
          entry.assignments.length !== 1 ||
          (entry.assignments[0]?.directory_id &&
            !model.byId.has(entry.assignments[0].directory_id)),
      )
    )
      problems.add('接口分类缺失、重复或目录引用异常。')
    for (const group of groups) {
      const ids = new Set(group.member_ids)
      if (ids.size < 2 || ids.size !== group.member_ids.length || !ids.has(group.representative_id))
        problems.add('合并成员重复、数量不足或未包含代表接口。')
      if (!group.reason.trim() || [...group.reason].length > 1000) problems.add('合并理由无效。')
      const representative = entries.get(group.representative_id)
      for (const id of group.member_ids) {
        if (byMember.has(id)) problems.add('同一接口出现在多个合并组中。')
        byMember.set(id, group)
        const member = entries.get(id)
        if (!member || !representative) {
          problems.add('合并组引用了未知接口。')
          continue
        }
        if (member.item.method !== representative.item.method)
          problems.add('合并成员的请求方法不一致。')
        if (
          (member.assignments[0]?.directory_id ?? null) !==
          (representative.assignments[0]?.directory_id ?? null)
        )
          problems.add('合并成员不在同一个目录。')
        if (!covers(group.path_template, member.item.path))
          problems.add('模板路径不能覆盖全部成员。')
      }
    }
    const expected =
      model.entries.length - groups.reduce((sum, group) => sum + group.member_ids.length - 1, 0)
    if (
      task.review?.metrics.logical_interfaces != null &&
      task.review.metrics.logical_interfaces !== expected
    )
      problems.add('合并数量与检查结果不一致。')
  }
  const fallback = problems.size > 0
  if (fallback) byMember.clear()
  const rendered = new Set<InterfaceMergeGroup>()
  const cards: PreviewCard[] = []
  for (const [index, entry] of model.entries.entries()) {
    const group = byMember.get(entry.item.interface_id)
    if (group) {
      if (rendered.has(group)) continue
      rendered.add(group)
      cards.push({
        key: `group:${group.representative_id}`,
        method: entry.item.method,
        path: group.path_template,
        group,
        members: group.member_ids.map((id) => entries.get(id)!),
      })
    } else {
      cards.push({
        key: `interface:${entry.item.interface_id}:${index}`,
        method: entry.item.method,
        path: entry.item.path,
        group: null,
        members: [entry],
      })
    }
  }
  return { cards, byMember, fallback, problems: [...problems], groupCount: rendered.size }
}

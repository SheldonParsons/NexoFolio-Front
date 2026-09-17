import type { PreviewTask, PreviewNode } from '@/contracts/catalog-preview/1.4.0/types.generated'

export const statusLabels = {
  pending: '等待生成',
  running: '生成中',
  ready: '可预览',
  rejected: '结构检查未通过',
  failed: '生成失败',
} as const

export const ALL = '__all__'
export const UNCLASSIFIED = '__unclassified__'
export interface DirectoryRow {
  key: string
  node: PreviewNode
  depth: number
  ancestors: string[]
  hasChildren: boolean
}

/** Validate links before walking; rejected proposals may contain cycles or duplicate IDs. */
export function previewModel(task: PreviewTask) {
  const nodes = task.candidate?.nodes ?? []
  const assignments = task.candidate?.assignments ?? []
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const children = new Map<string | null, PreviewNode[]>()
  let flat = task.status === 'rejected' || task.review?.structurally_valid === false
  if (byId.size !== nodes.length) flat = true
  for (const node of nodes) {
    const parent = node.parent ?? null
    if (parent !== null && !byId.has(parent)) flat = true
    const siblings = children.get(parent) ?? []
    siblings.push(node)
    children.set(parent, siblings)
  }
  // Iterative traversal cannot overflow the call stack, even with unusually deep proposals.
  const rows: DirectoryRow[] = []
  const seen = new Set<string>()
  const stack = (children.get(null) ?? [])
    .slice()
    .reverse()
    .map((node) => ({ node, ancestors: [] as string[] }))
  while (stack.length) {
    const { node, ancestors } = stack.pop()!
    if (seen.has(node.id)) {
      flat = true
      continue
    }
    seen.add(node.id)
    const descendants = children.get(node.id) ?? []
    rows.push({
      key: node.id,
      node,
      depth: ancestors.length,
      ancestors,
      hasChildren: !!descendants.length,
    })
    for (let index = descendants.length - 1; index >= 0; index--)
      stack.push({ node: descendants[index]!, ancestors: [...ancestors, node.id] })
  }
  if (seen.size !== nodes.length) flat = true
  const directories = flat
    ? nodes.map((node, index) => ({
        key: `${node.id}:${index}`,
        node,
        depth: 0,
        ancestors: [],
        hasChildren: false,
      }))
    : rows
  const entries = task.snapshot.interfaces.map((item) => {
    const matches = assignments.filter(
      (assignment) => assignment.interface_id === item.interface_id,
    )
    return {
      item,
      assignments: matches,
      unclassified:
        !matches.length ||
        matches.some(
          (assignment) => !assignment.directory_id || !byId.has(assignment.directory_id),
        ),
    }
  })
  return { flat, directories, entries, byId }
}

export function previewError(error: unknown): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? error.status : null
  if (status === 401) return '登录已过期，请重新登录。'
  if (status === 403) return '暂无此项目的访问权限，请联系项目负责人。'
  if (status === 404) return '未找到项目或候选任务，请重新读取任务列表。'
  if (status === 503) return '候选目录服务或项目权限信息暂不可用，请稍后重试。'
  return error instanceof Error ? error.message : '暂时无法读取候选目录，请重试。'
}

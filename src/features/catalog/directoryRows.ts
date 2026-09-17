import type { CatalogDirectory } from './types'

export function catalogRows(nodes: CatalogDirectory[], unclassifiedId: string) {
  const regular = nodes.filter((node) => node.id !== unclassifiedId)
  const byId = new Map(regular.map((node) => [node.id, node]))
  const children = new Map<string | null, CatalogDirectory[]>()
  let invalid = byId.size !== regular.length
  for (const node of regular) {
    if (node.parent && !byId.has(node.parent)) invalid = true
    const group = children.get(node.parent) ?? []
    group.push(node)
    children.set(node.parent, group)
  }
  const rows: { node: CatalogDirectory; depth: number }[] = []
  const pending = (children.get(null) ?? [])
    .slice()
    .reverse()
    .map((node) => ({ node, depth: 0 }))
  const seen = new Set<string>()
  while (pending.length) {
    const row = pending.pop()!
    if (seen.has(row.node.id)) {
      invalid = true
      continue
    }
    rows.push(row)
    seen.add(row.node.id)
    for (const node of (children.get(row.node.id) ?? []).slice().reverse())
      pending.push({ node, depth: row.depth + 1 })
  }
  if (seen.size !== regular.length) invalid = true
  return { invalid, rows: invalid ? regular.map((node) => ({ node, depth: 0 })) : rows }
}

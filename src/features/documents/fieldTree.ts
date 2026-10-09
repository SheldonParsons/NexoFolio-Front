import type { FieldFacts, FieldNote } from '@/contracts/knowledge/types'
import { fieldPath } from '@/features/knowledge/fieldPresentation'

export function fieldKey(field: FieldFacts): string {
  const location =
    field.location.in === 'response_body' || field.location.in === 'response_header'
      ? `${field.location.in}:${field.location.status}`
      : field.location.in
  return `${location}:${field.path.length ? fieldPath(field.path) : ''}`
}

export interface FieldNode {
  key: string
  name: string
  path: string
  field: FieldFacts
  note?: FieldNote
  children: FieldNode[]
  /** Presentation-only array element wrapper; the original field remains addressable. */
  item?: FieldNode
}

export function fieldTree(fields: FieldFacts[], notes: FieldNote[]): FieldNode[] {
  const nodes = fields.map((field): FieldNode => {
    const last = field.path.at(-1)
    return {
      key: fieldKey(field),
      name: !last
        ? '整个报文'
        : last === 'items'
          ? '每个元素'
          : typeof last === 'object'
            ? last.key
            : last,
      path: fieldPath(field.path),
      field,
      note:
        notes.find((note) => note.path === fieldKey(field)) ??
        notes.find(
          (note) =>
            !note.context?.location &&
            note.path === (field.path.length ? fieldPath(field.path) : ''),
        ),
      children: [],
    }
  })
  const roots: FieldNode[] = []
  for (const node of nodes) {
    const parentPath = node.field.path.slice(0, -1)
    const parent = node.field.path.length
      ? nodes.find((other) => other.key === fieldKey({ ...node.field, path: parentPath }))
      : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Inline an object array's wrapper while preserving its note and original path. */
export function compactFieldTree(fields: FieldFacts[], notes: FieldNote[]): FieldNode[] {
  const visit = (node: FieldNode): FieldNode => {
    const children = node.children.map(visit)
    const item = children.length === 1 ? children[0] : undefined
    if (
      node.field.types.includes('array') &&
      item?.field.path.at(-1) === 'items' &&
      item.field.types.length === 1 &&
      item.field.types[0] === 'object' &&
      item.children.length
    ) {
      return { ...node, children: item.children, item }
    }
    return { ...node, children }
  }
  return fieldTree(fields, notes).map(visit)
}

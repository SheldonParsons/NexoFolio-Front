import { cellText, sensitivePath } from './presentation'
export interface DiffInput {
  id: string
  value: unknown
  complete: boolean
}
export type DiffKind = 'same' | 'added' | 'removed' | 'changed' | 'unknown'
export interface DiffCell {
  text: string
  type: string
  kind: DiffKind
}
export interface DiffRow {
  path: string
  name: string
  depth: number
  cells: DiffCell[]
  changed: boolean
  container: boolean
}
export interface SampleDiffResult {
  rows: DiffRow[]
  changed: number
  added: number
  removed: number
  modified: number
  unknown: number
  positionalArrays: number
  identifiedArrays: number
  truncated: boolean
}
const missing = Symbol('missing')
function type(value: unknown) {
  return value === missing
    ? 'missing'
    : value === null
      ? 'null'
      : Array.isArray(value)
        ? 'array'
        : typeof value
}
function plain(value: unknown): value is Record<string, unknown> {
  return type(value) === 'object'
}
function uniqueIds(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => plain(v) && ['string', 'number'].includes(typeof v.id)) &&
    new Set(value.map((v) => String(v.id))).size === value.length
  )
}
export function compareSamples(
  inputs: DiffInput[],
  align: 'position' | 'id' = 'position',
): SampleDiffResult {
  const result: SampleDiffResult = {
    rows: [],
    changed: 0,
    added: 0,
    removed: 0,
    modified: 0,
    unknown: 0,
    positionalArrays: 0,
    identifiedArrays: 0,
    truncated: false,
  }
  if (inputs.length < 2) return result
  const visit = (
    values: unknown[],
    path: string[],
    depth: number,
    name: string,
    masked = false,
  ) => {
    if (result.rows.length >= 100_000 || depth > 96) {
      result.truncated = true
      return
    }
    values = values.map((value) => (value === undefined ? missing : value))
    const baseline = values[0],
      baseType = type(baseline)
    const present = values.filter((v) => v !== missing)
    const objects = present.some(plain),
      arrays = !objects && present.some(Array.isArray)
    const container = objects || arrays
    const cells = values.map((value, index): DiffCell => {
      const valueType = type(value)
      let kind: DiffKind = 'same'
      if (index > 0) {
        if (value === missing && baseline !== missing)
          kind = inputs[index]!.complete ? 'removed' : 'unknown'
        else if (baseline === missing && value !== missing)
          kind = inputs[0]!.complete ? 'added' : 'unknown'
        else if (baseType !== valueType || (!container && !Object.is(value, baseline)))
          kind = 'changed'
      }
      return {
        text:
          value === missing
            ? kind === 'unknown'
              ? '未见 · 内容不完整'
              : '未出现'
            : cellText(value, masked ? ['authorization'] : path),
        type: valueType,
        kind,
      }
    })
    const changed = cells.some((c) => c.kind !== 'same')
    result.rows.push({
      path: '/' + path.map((p) => p.replaceAll('~', '~0').replaceAll('/', '~1')).join('/'),
      name,
      depth,
      cells,
      changed,
      container,
    })
    if (changed) {
      result.changed++
      for (const kind of ['added', 'removed', 'changed', 'unknown'] as const)
        if (cells.some((c) => c.kind === kind)) result[kind === 'changed' ? 'modified' : kind]++
    }
    if (objects) {
      const keys = new Set(values.flatMap((v) => (plain(v) ? Object.keys(v) : [])))
      for (const key of keys)
        visit(
          values.map((v) => (plain(v) && Object.hasOwn(v, key) ? v[key] : missing)),
          [...path, key],
          depth + 1,
          key,
          masked,
        )
    } else if (arrays) {
      const headerPair = present.some(
        (v) =>
          Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && sensitivePath([v[0]]),
      )
      const idAligned = align === 'id' && present.every(uniqueIds)
      if (idAligned) {
        result.identifiedArrays++
        const ids = new Set(
          present.flatMap((v) =>
            (v as Array<Record<string, unknown>>).map((item) => String(item.id)),
          ),
        )
        const indexed = values.map((v) =>
          Array.isArray(v)
            ? new Map(v.map((item) => [String((item as Record<string, unknown>).id), item]))
            : new Map<string, unknown>(),
        )
        for (const id of ids)
          visit(
            indexed.map((map) => (map.has(id) ? map.get(id) : missing)),
            [...path, `id=${id}`],
            depth + 1,
            `[id=${id}]`,
            masked,
          )
      } else {
        result.positionalArrays++
        const length = Math.max(0, ...present.filter(Array.isArray).map((v) => v.length))
        for (let index = 0; index < length; index++)
          visit(
            values.map((v) => (Array.isArray(v) && index < v.length ? v[index] : missing)),
            [...path, String(index)],
            depth + 1,
            `[${index}]`,
            masked || (headerPair && index === 1),
          )
      }
    }
  }
  visit(
    inputs.map((i) => i.value),
    [],
    0,
    '根节点',
  )
  return result
}

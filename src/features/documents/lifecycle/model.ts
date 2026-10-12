import type { FieldFacts } from '@/contracts/knowledge/types'
import type {
  DocumentLifecycle,
  LifecycleTarget,
  Retirement,
} from '@/contracts/knowledge/lifecycle'
export type {
  DocumentLifecycle,
  LifecycleTarget,
  Retirement,
} from '@/contracts/knowledge/lifecycle'
export const emptyLifecycle = (): DocumentLifecycle => ({
  version: 0,
  reconciled_version: 0,
  decisions: [],
})
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
export function sameTarget(a: LifecycleTarget, b: LifecycleTarget) {
  return (
    a.kind === b.kind &&
    (a.kind === 'field' && b.kind === 'field'
      ? a.endpoint === b.endpoint && same(a.location, b.location) && same(a.path, b.path)
      : a.kind !== 'field' && b.kind !== 'field' && a.id === b.id)
  )
}
function canonical(state: DocumentLifecycle | undefined, id: string): string {
  return state?.aliases?.find(([old]) => old === id)?.[1] ?? id
}
export function retirement(
  state: DocumentLifecycle | undefined,
  target: LifecycleTarget,
): Retirement | undefined {
  const endpoint =
    target.kind === 'field' ? target.endpoint : target.kind === 'endpoint' ? target.id : ''
  const sameEndpoint = (id: string) => canonical(state, id) === canonical(state, endpoint)
  return (
    state?.decisions.find(
      (d) => d.retired && d.target.kind === 'endpoint' && sameEndpoint(d.target.id),
    ) ??
    state?.decisions.find((d) => {
      if (!d.retired) return false
      if (target.kind === 'folder')
        return (
          d.target.kind === 'folder' && (d.target.id === target.id || d.folders.includes(target.id))
        )
      if (target.kind === 'field' && d.target.kind === 'field')
        return (
          sameEndpoint(d.target.endpoint) &&
          same(d.target.location, target.location) &&
          d.target.path.every((segment, i) => same(segment, target.path[i]))
        )
      return sameTarget(d.target, target)
    })
  )
}
export function hiddenRetirement(state: DocumentLifecycle | undefined, target: LifecycleTarget) {
  const decision = retirement(state, target)
  return !!decision && decision.version <= (state?.reconciled_version ?? 0)
}

export function sourceRetired(
  state: DocumentLifecycle | undefined,
  endpoint: string,
  field: string,
  location?: FieldFacts['location'] | null,
) {
  if (retirement(state, { kind: 'endpoint', id: endpoint })) return true
  return (
    state?.decisions.some((d) => {
      if (
        !d.retired ||
        d.target.kind !== 'field' ||
        !location ||
        !same(d.target.location, location)
      )
        return false
      const target = d.target
      if (canonical(state, target.endpoint) !== canonical(state, endpoint)) return false
      const path = d.target.path
        .map((s, i) => (typeof s === 'string' ? '[]' : (i > 0 ? '.' : '') + s.key))
        .join('')
      return (
        path === '' ||
        field === path ||
        field.startsWith(path + '.') ||
        field.startsWith(path + '[]')
      )
    }) ?? false
  )
}

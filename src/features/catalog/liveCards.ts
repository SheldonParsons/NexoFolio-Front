import type { CatalogState, LiveCatalogInterface } from './types'

export function liveCards(state: CatalogState, items: LiveCatalogInterface[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const group of state.groups)
    for (const id of group.member_ids) {
      if (seen.has(id)) duplicates.add(id)
      seen.add(id)
    }
  const byId = new Map(items.map((item) => [item.id, item]))
  const valid = state.groups.filter(
    (group) =>
      group.member_ids.length >= 2 &&
      group.member_ids.includes(group.representative_id) &&
      group.member_ids.every((id) => !duplicates.has(id) && byId.has(id)) &&
      new Set(group.member_ids.map((id) => byId.get(id)!.method)).size === 1,
  )
  const groups = new Map(
    valid.flatMap((group) => group.member_ids.map((id) => [id, group] as const)),
  )
  const emitted = new Set<string>()
  const cards = [] as {
    key: string
    path: string
    method: string
    reason: string | null
    members: LiveCatalogInterface[]
  }[]
  for (const item of items) {
    const group = groups.get(item.id)
    if (group) {
      if (emitted.has(group.representative_id)) continue
      emitted.add(group.representative_id)
      cards.push({
        key: `group:${group.representative_id}`,
        path: group.path_template,
        method: item.method,
        reason: group.reason,
        members: group.member_ids.map((id) => byId.get(id)!),
      })
    } else
      cards.push({
        key: item.id,
        path: item.path,
        method: item.method,
        reason: null,
        members: [item],
      })
  }
  return {
    cards,
    partial: state.groups.some(
      (group) => group.member_ids.some((id) => byId.has(id)) && !valid.includes(group),
    ),
  }
}

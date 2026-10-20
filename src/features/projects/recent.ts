import { shallowRef } from 'vue'
import type { Project, ProjectSource } from './types'
export interface RecentVisit {
  id: string
  visitedAt: number
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export const RECENT_PROJECT_LIMIT = 5
// Notify mounted consumers without creating another history or persisting project metadata.
export const recentVisitChange = shallowRef<{ scope: string; project?: Project }>()
const VISIT_HISTORY_LIMIT = 20
const keyFor = (scope: string) => `nexofolio.recent-projects.v1:${encodeURIComponent(scope)}`
export function readVisits(scope: string, storage?: StoragePort): RecentVisit[] {
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(keyFor(scope)) || '[]')
    if (!Array.isArray(value)) return []
    const seen = new Set<string>()
    return value
      .filter((entry): entry is RecentVisit => {
        if (
          !entry ||
          typeof entry.id !== 'string' ||
          !entry.id ||
          typeof entry.visitedAt !== 'number' ||
          !Number.isFinite(entry.visitedAt)
        )
          return false
        return true
      })
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .filter((entry) => {
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      })
      .slice(0, VISIT_HISTORY_LIMIT)
      .map(({ id, visitedAt }) => ({ id, visitedAt }))
  } catch {
    return []
  }
}
function write(scope: string, entries: RecentVisit[], storage?: StoragePort) {
  try {
    ;(storage ?? localStorage).setItem(keyFor(scope), JSON.stringify(entries))
  } catch {
    /* Convenience only: unavailable storage must never block access. */
  }
}
export function recordVisit(
  scope: string,
  project: string | Project,
  storage?: StoragePort,
  now = Date.now(),
) {
  const id = typeof project === 'string' ? project : project.project_id
  write(
    scope,
    [
      { id, visitedAt: now },
      ...readVisits(scope, storage).filter((visit) => visit.id !== id),
    ].slice(0, VISIT_HISTORY_LIMIT),
    storage,
  )
  recentVisitChange.value = { scope, project: typeof project === 'string' ? undefined : project }
}
export function removeVisit(scope: string, id: string, storage?: StoragePort) {
  write(
    scope,
    readVisits(scope, storage).filter((visit) => visit.id !== id),
    storage,
  )
  recentVisitChange.value = { scope }
}
export async function resolveRecent(
  scope: string,
  source: ProjectSource,
  known: Project[],
  signal: AbortSignal,
  storage?: StoragePort,
): Promise<Project[]> {
  if (signal.aborted) return []
  // Keep the v1 cache and its 20 visits so older valid entries can fill revoked/deleted slots.
  const visits = readVisits(scope, storage)
  const missing = visits.filter((visit) => !known.some((p) => p.project_id === visit.id))
  const fetched = missing.length
    ? (
        await source.list(
          { page: 1, limit: VISIT_HISTORY_LIMIT, ids: missing.map((v) => v.id) },
          signal,
        )
      ).items
    : []
  if (signal.aborted) return []
  const projects = new Map([...fetched, ...known].map((p) => [p.project_id, p]))
  const removed = new Set<string>()
  const recent: Project[] = []
  for (const visit of visits) {
    const project = projects.get(visit.id)
    if (!project || project.access_state === 'denied') removed.add(visit.id)
    else if (
      project.can_access &&
      project.access_state === 'allowed' &&
      recent.length < RECENT_PROJECT_LIMIT
    )
      recent.push(project)
  }
  if (removed.size)
    write(
      scope,
      readVisits(scope, storage).filter(
        (visit) =>
          !removed.has(visit.id) ||
          !visits.some(
            (checked) => checked.id === visit.id && checked.visitedAt === visit.visitedAt,
          ),
      ),
      storage,
    )
  return recent
}

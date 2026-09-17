import { ApiError } from '@/api/client'
import type { Project, ProjectSource } from './types'
export interface RecentVisit {
  id: string
  visitedAt: number
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
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
          !Number.isFinite(entry.visitedAt) ||
          seen.has(entry.id)
        )
          return false
        seen.add(entry.id)
        return true
      })
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, 20)
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
export function recordVisit(scope: string, id: string, storage?: StoragePort, now = Date.now()) {
  write(
    scope,
    [
      { id, visitedAt: now },
      ...readVisits(scope, storage).filter((visit) => visit.id !== id),
    ].slice(0, 20),
    storage,
  )
}
export function removeVisit(scope: string, id: string, storage?: StoragePort) {
  write(
    scope,
    readVisits(scope, storage).filter((visit) => visit.id !== id),
    storage,
  )
}
export async function resolveRecent(
  scope: string,
  source: ProjectSource,
  known: Project[],
  signal: AbortSignal,
  storage?: StoragePort,
): Promise<Project[]> {
  const visits = readVisits(scope, storage).slice(0, 3)
  const removed = new Set<string>()
  const rows = await Promise.all(
    visits.map(async (visit) => {
      try {
        const project =
          known.find((item) => item.project_id === visit.id) ?? (await source.get(visit.id, signal))
        if (!project.can_access || project.access_state !== 'allowed') {
          if (project.access_state === 'denied') removed.add(visit.id)
          return null
        }
        return project
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404))
          removed.add(visit.id)
        if (error instanceof ApiError && error.status === 401) throw error
        return null
      }
    }),
  )
  if (signal.aborted) return []
  if (removed.size)
    write(
      scope,
      readVisits(scope, storage).filter((visit) => !removed.has(visit.id)),
      storage,
    )
  return rows.filter((project): project is Project => project !== null)
}

import type { RebuildAttemptStore, RebuildRequest } from './ports'
const pending = new Map<string, RebuildRequest>()
export function createRebuildStore(
  scope: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): RebuildAttemptStore {
  const key = (projectId: string) => `nexofolio:rebuild:${scope}:${projectId}`
  return {
    read(projectId) {
      if (pending.has(key(projectId))) return pending.get(key(projectId))!
      try {
        const raw = storage?.getItem(key(projectId))
        if (!raw) return null
        const value = JSON.parse(raw)
        if (value.projectId !== projectId || typeof value.requestKey !== 'string') return null
        return { projectId, requestKey: value.requestKey }
      } catch {
        return null
      }
    },
    save(value) {
      pending.set(key(value.projectId), { ...value })
      try {
        storage?.setItem(key(value.projectId), JSON.stringify(value))
      } catch {
        /* In-memory recovery remains available. */
      }
    },
    clear(projectId) {
      pending.delete(key(projectId))
      try {
        storage?.removeItem(key(projectId))
      } catch {
        /* Receipt replay remains safe if stale storage survives. */
      }
    },
  }
}

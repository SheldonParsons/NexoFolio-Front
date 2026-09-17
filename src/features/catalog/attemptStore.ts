import type { AttemptStore, CatalogAttempt } from './change'

const memory = new Map<string, CatalogAttempt>()
export function createAttemptStore(
  key: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined,
): AttemptStore {
  return {
    read() {
      if (memory.has(key)) return memory.get(key)!
      try {
        const raw = storage?.getItem(key)
        if (!raw) return null
        const value = JSON.parse(raw) as CatalogAttempt
        if (
          !value ||
          typeof value.request_id !== 'string' ||
          !Number.isSafeInteger(value.expected_generation) ||
          value.expected_generation < 0 ||
          (value.kind !== 'publish' && value.kind !== 'restore') ||
          (value.kind === 'publish' && typeof value.task_id !== 'string') ||
          (value.kind === 'restore' &&
            value.version_id !== null &&
            typeof value.version_id !== 'string')
        )
          return null
        memory.set(key, value)
        return value
      } catch {
        return null
      }
    },
    save(attempt) {
      memory.set(key, { ...attempt })
      try {
        storage?.setItem(key, JSON.stringify(attempt))
      } catch {
        /* In-memory retry remains available when storage is unavailable. */
      }
    },
    clear() {
      memory.delete(key)
      try {
        storage?.removeItem(key)
      } catch {
        /* No credentials or interface content are stored. */
      }
    },
  }
}

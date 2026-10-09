import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { Project } from '@/features/projects/types'

export interface ActiveProjectContext {
  projectId: string
  name: string
  environmentId: string
}
const keyFor = (scope: string) => `nexofolio.active-project.v1:${encodeURIComponent(scope)}`
function restore(scope: string): ActiveProjectContext | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(keyFor(scope)) || 'null')
    if (!value || typeof value !== 'object') return null
    const row = value as Partial<ActiveProjectContext>
    if (
      typeof row.projectId !== 'string' ||
      !row.projectId ||
      typeof row.name !== 'string' ||
      !row.name ||
      typeof row.environmentId !== 'string'
    )
      return null
    return { projectId: row.projectId, name: row.name, environmentId: row.environmentId }
  } catch {
    return null
  }
}

/** Navigation context only. Backend authorization remains authoritative on every destination. */
export const useProjectContextStore = defineStore('project-context', () => {
  const scope = ref('')
  const current = shallowRef<ActiveProjectContext | null>(null)
  function activate(owner: string) {
    if (scope.value === owner) return
    scope.value = owner
    current.value = owner ? restore(owner) : null
  }
  function remember(owner: string, project: Project, environmentId?: string) {
    if (
      !owner ||
      !project.project_id ||
      !project.name ||
      !project.can_access ||
      project.access_state !== 'allowed'
    )
      return
    activate(owner)
    const previous = current.value
    current.value = {
      projectId: project.project_id,
      name: project.name,
      environmentId:
        environmentId ?? (previous?.projectId === project.project_id ? previous.environmentId : ''),
    }
    try {
      sessionStorage.setItem(keyFor(owner), JSON.stringify(current.value))
    } catch {
      /* Keep working when browser storage is unavailable. */
    }
  }
  function clear() {
    if (scope.value) {
      try {
        sessionStorage.removeItem(keyFor(scope.value))
      } catch {
        /* Best effort. */
      }
    }
    scope.value = ''
    current.value = null
  }
  return { current, scope, activate, remember, clear }
})

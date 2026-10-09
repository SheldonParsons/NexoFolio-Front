import { computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectContextStore } from '@/stores/projectContext'
import { projectScope } from './source'
import type { Project } from './types'

/** Scope the last successfully entered project to the backend and signed-in user. */
export function useActiveProject() {
  const auth = useAuthStore(),
    context = useProjectContextStore()
  const scope = computed(() => (auth.user?.id ? `${projectScope}:${auth.user.id}` : ''))
  watch(scope, context.activate, { immediate: true, flush: 'sync' })
  const current = computed(() => (context.scope === scope.value ? context.current : null))
  function remember(project: Project, environmentId?: string) {
    context.remember(scope.value, project, environmentId)
  }
  return { current, remember }
}

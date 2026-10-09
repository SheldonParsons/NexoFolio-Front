import type { RouteLocationNormalized } from 'vue-router'
import type { ActiveProjectContext } from '@/stores/projectContext'

/** An explicit project route wins; other pages retain the last entered project. */
export function navigationProject(
  route: Pick<RouteLocationNormalized, 'params' | 'query'>,
  selected: ActiveProjectContext | null,
): ActiveProjectContext | null {
  const routeId = typeof route.params.projectId === 'string' ? route.params.projectId : ''
  if (!routeId) return selected
  const sameProject = selected?.projectId === routeId
  return {
    projectId: routeId,
    name: sameProject ? selected.name : '',
    environmentId:
      typeof route.query.env === 'string'
        ? route.query.env
        : sameProject
          ? selected.environmentId
          : '',
  }
}

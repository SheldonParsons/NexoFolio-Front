import type { RouteLocationNormalized, RouteLocationNamedRaw } from 'vue-router'
export type DocumentTarget = { kind: 'folder' | 'endpoint'; id: string } | null
export function documentTarget(route: Pick<RouteLocationNormalized, 'params'>): DocumentTarget {
  const folder = route.params.folderId
  const endpoint = route.params.endpointId
  if (typeof folder === 'string' && folder) return { kind: 'folder', id: folder }
  if (typeof endpoint === 'string' && endpoint) return { kind: 'endpoint', id: endpoint }
  return null
}
export function documentLocation(
  projectId: string,
  target: DocumentTarget,
  env = '',
  tab = 'fields',
): RouteLocationNamedRaw {
  return {
    name:
      target?.kind === 'folder'
        ? 'document-folder'
        : target
          ? 'document-endpoint'
          : 'project-interfaces',
    params: {
      projectId,
      ...(target ? { [target.kind === 'folder' ? 'folderId' : 'endpointId']: target.id } : {}),
    },
    query: {
      ...(env ? { env } : {}),
      ...(target?.kind === 'endpoint' && tab === 'examples' ? { tab } : {}),
    },
  }
}
export function sameDocumentProject(
  to: { name?: string | symbol | null; params: RouteLocationNormalized['params'] },
  from: { name?: string | symbol | null; params: RouteLocationNormalized['params'] },
) {
  const names = ['project-interfaces', 'document-folder', 'document-endpoint']
  return (
    names.includes(String(to.name)) &&
    names.includes(String(from.name)) &&
    to.params.projectId === from.params.projectId
  )
}

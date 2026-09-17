import { api } from '@/api'
import { createLiveProjectSource } from './repository'
import type { ProjectSource } from './types'

export const projectsAreMock =
  import.meta.env.VITE_PROJECTS_SOURCE === 'mock' ||
  (import.meta.env.DEV && import.meta.env.VITE_PROJECTS_SOURCE !== 'live')
export const supportsProjectQuery =
  projectsAreMock || import.meta.env.VITE_PROJECTS_QUERY_API === 'true'
export const projectScope =
  new URL(import.meta.env.VITE_API_BASE_URL || '/api', window.location.origin).href +
  ':' +
  (projectsAreMock ? 'mock' : 'live')
const live = createLiveProjectSource(api.request, supportsProjectQuery)
async function source() {
  return projectsAreMock ? (await import('./mock')).mockProjects : live
}
export const projectSource: ProjectSource = {
  async list(query, signal) {
    return (await source()).list(query, signal)
  },
  async get(id, signal) {
    return (await source()).get(id, signal)
  },
}

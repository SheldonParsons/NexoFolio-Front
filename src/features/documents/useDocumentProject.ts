import { computed, ref, shallowRef } from 'vue'
import { projectSource } from '@/features/projects/source'
import type { Project } from '@/features/projects/types'
import * as knowledge from '@/contracts/knowledge/source'
import type { CurateProgress } from '@/contracts/knowledge/types'
import * as source from './source'
import { publicIndex } from './public/source'
import type { ProjectEnvironment } from './types'
import type { DocumentRequests, DocumentErrorReporter } from './documentRequests'

/** Project reads, environment choice, catalog/search projection. */
export function useDocumentProject(
  projectId: () => string,
  requests: DocumentRequests,
  report: DocumentErrorReporter,
  readOnly = false,
) {
  const project = shallowRef<Project | null>(null)
  const environments = shallowRef<ProjectEnvironment[]>([])
  const environmentId = ref('')
  const index = shallowRef<source.DocumentIndex | null>(null)
  const loading = ref(false),
    error = ref(''),
    query = ref('')
  const projectEndpointCount = computed(() => index.value?.entries.length ?? 0)
  const folderCount = computed(() => index.value?.catalog.folders.length ?? 0)
  const currentEnvironment = computed(() =>
    environments.value.find((e) => e.id === environmentId.value),
  )
  const visibleEntries = computed(() =>
    (index.value?.entries ?? []).filter((entry) =>
      entry.summary.environments.some((env) => env.environment_id === environmentId.value),
    ),
  )
  const sections = computed(() => {
    const needle = query.value.trim().toLowerCase()
    const entries = visibleEntries.value.filter(
      (entry) =>
        !needle ||
        [entry.method, entry.path, entry.name ?? '', entry.purpose ?? ''].some((value) =>
          value.toLowerCase().includes(needle),
        ),
    )
    return [
      ...(index.value?.catalog.folders ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        entries: entries.filter((e) => e.folderId === folder.id),
      })),
      { id: 'unplaced', name: '待分类', entries: entries.filter((e) => !e.folderId) },
    ].filter((section) => section.entries.length)
  })
  async function loadProject() {
    const request = requests.begin('project')
    loading.value = true
    error.value = ''
    const pid = projectId()
    let running: CurateProgress | undefined
    try {
      if (readOnly) {
        const document = await publicIndex(pid, request.signal)
        if (!request.current()) return
        project.value = {
          ...document.project,
          can_access: false,
          access_state: 'denied',
          reason_code: null,
        }
        environments.value = document.project.environments
        index.value = document
        if (!environments.value.some((e) => e.id === environmentId.value))
          environmentId.value = environments.value[0]?.id ?? ''
        return
      }
      const [value, envs, document, job] = await Promise.all([
        projectSource.get(pid, request.signal),
        source.environments(pid, request.signal),
        source.documentIndex(pid, request.signal),
        knowledge.curateProgress(pid, request.signal),
      ])
      if (!request.current()) return
      if (!value.can_access || value.access_state !== 'allowed')
        throw new Error('暂无此项目的访问权限。')
      project.value = value
      environments.value = envs
      index.value = document
      if (job.status === 'running' && !['applied', 'discarded'].includes(job.candidate_state ?? ''))
        running = job
      if (!envs.some((e) => e.id === environmentId.value)) environmentId.value = envs[0]?.id ?? ''
    } catch (cause) {
      if (request.current()) report(cause, error)
    } finally {
      if (request.current()) loading.value = false
    }
    return request.current() ? running : undefined
  }
  function reset() {
    project.value = null
    index.value = null
    environments.value = []
    environmentId.value = ''
    query.value = ''
  }
  return {
    project,
    environments,
    environmentId,
    index,
    loading,
    error,
    query,
    currentEnvironment,
    visibleEntries,
    sections,
    projectEndpointCount,
    folderCount,
    loadProject,
    reset,
  }
}

import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { readBrowserView } from '@/features/projects/browserState'
import {
  readVisits,
  recentVisitChange,
  resolveRecent,
  RECENT_PROJECT_LIMIT,
} from '@/features/projects/recent'
import type { Project, ProjectSource } from '@/features/projects/types'

export const NAVIGATION_RECENT_LIMIT = 4
const REFRESH_AFTER_MS = 30_000

/** A small view over the existing history; opening a menu never records a visit. */
export function useNavigationRecentProjects(
  source: ProjectSource,
  scope: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const items = ref<Project[]>([])
  const loading = ref(false)
  const failed = ref(false)
  let controller: AbortController | undefined
  let resolvedAt = 0
  let resolvedVisits = ''
  // Only metadata already read for this identity; the persisted v1 history still owns order.
  const confirmed = new Map<string, { project: Project; checkedAt: number }>()
  function remember(projects: Project[], checkedAt: number) {
    for (const project of projects) {
      if (checkedAt >= (confirmed.get(project.project_id)?.checkedAt ?? 0))
        confirmed.set(project.project_id, { project, checkedAt })
    }
  }
  function syncHistory() {
    const visits = readVisits(toValue(scope))
    const ids = new Set(visits.map((visit) => visit.id))
    for (const id of confirmed.keys()) if (!ids.has(id)) confirmed.delete(id)
    items.value = visits
      .map((visit) => confirmed.get(visit.id)?.project)
      .filter(
        (project): project is Project =>
          !!project && project.can_access && project.access_state === 'allowed',
      )
      .slice(0, RECENT_PROJECT_LIMIT)
    return visits
  }
  function invalidate(clear = false) {
    controller?.abort()
    controller = undefined
    if (clear) confirmed.clear()
    syncHistory()
    loading.value = false
    failed.value = false
    resolvedAt = 0
  }
  async function load() {
    const owner = toValue(scope)
    if (!owner || loading.value) return
    // Also notice pruning by the project list or a visit made in another tab.
    const visits = JSON.stringify(readVisits(owner))
    if (resolvedAt && visits === resolvedVisits && Date.now() - resolvedAt < REFRESH_AFTER_MS)
      return
    const request = new AbortController()
    controller = request
    loading.value = true
    failed.value = false
    // Retain the same account's last list as a fallback; only fresh evidence skips rechecking.
    const browser = readBrowserView(owner)
    remember(browser.result?.items ?? [], browser.validatedAt ?? 0)
    const history = syncHistory()
    const known = [...confirmed.values()]
      .filter((entry) => Date.now() - entry.checkedAt < REFRESH_AFTER_MS)
      .map((entry) => entry.project)
    const knownIds = new Set(known.map((project) => project.project_id))
    try {
      const value = await resolveRecent(owner, source, known, request.signal)
      if (request.signal.aborted || toValue(scope) !== owner) return
      // A completed check supersedes stale metadata, including unknown/revoked/missing IDs.
      for (const visit of history) if (!knownIds.has(visit.id)) confirmed.delete(visit.id)
      remember(
        value.filter((project) => !knownIds.has(project.project_id)),
        Date.now(),
      )
      syncHistory()
      resolvedVisits = JSON.stringify(readVisits(owner))
      resolvedAt = Math.min(Date.now(), ...[...confirmed.values()].map((entry) => entry.checkedAt))
    } catch {
      if (request.signal.aborted || toValue(scope) !== owner) return
      syncHistory()
      failed.value = true
      // Keep previously confirmed navigation labels; entry still checks current access.
    } finally {
      if (controller === request) loading.value = false
    }
  }
  watch(
    () => toValue(scope),
    () => {
      invalidate(true)
      if (toValue(enabled)) void load()
    },
    { flush: 'sync' },
  )
  watch(
    () => toValue(enabled),
    (open) => {
      if (open) void load()
    },
    { immediate: true },
  )
  watch(
    recentVisitChange,
    (change) => {
      if (change?.scope !== toValue(scope)) return
      if (change.project) remember([change.project], Date.now())
      invalidate()
      if (toValue(enabled)) void load()
    },
    { flush: 'sync' },
  )
  const message = computed(() =>
    loading.value
      ? '正在读取最近项目…'
      : failed.value || (toValue(scope) && !items.value.length && readVisits(toValue(scope)).length)
        ? '最近项目暂不可用，请从全部项目查看。'
        : '访问项目后会显示在这里。',
  )
  onScopeDispose(() => controller?.abort())
  return { items: computed(() => items.value.slice(0, NAVIGATION_RECENT_LIMIT)), loading, message }
}

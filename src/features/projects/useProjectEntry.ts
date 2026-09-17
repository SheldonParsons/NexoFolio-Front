import { onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '@/api/client'
import { clearCredential } from '@/api/session'
import { useAuthStore } from '@/stores/auth'
import { useNavigationTransition } from '@/stores/navigationTransition'
import { recordVisit, removeVisit } from './recent'
import type { Project, ProjectSource } from './types'

export function useProjectEntry(
  source: ProjectSource,
  scope: string,
  onUnavailable?: (id: string) => void,
) {
  const router = useRouter()
  const auth = useAuthStore()
  const transition = useNavigationTransition()
  const openingId = ref<string | null>(null)
  const explanation = ref('')
  const projectName = ref('')
  const dialogOpen = ref(false)
  let controller: AbortController | undefined
  let disposed = false
  let run: number | null = null
  let navigating = false
  async function open(project: Project) {
    if (openingId.value) return
    const request = new AbortController()
    controller = request
    openingId.value = project.project_id
    try {
      const current = await source.get(project.project_id, request.signal)
      if (disposed || request.signal.aborted) return
      if (!current.can_access || current.access_state !== 'allowed')
        throw new ApiError(
          '暂时无法确认项目权限。',
          'http',
          current.access_state === 'denied' ? 403 : 503,
        )
      run = transition.start(`正在进入${current.name}`, 2000)
      navigating = true
      const failure = await router.push(
        `/projects/${encodeURIComponent(current.project_id)}/catalog`,
      )
      if (failure) transition.finish(run)
      else {
        recordVisit(scope, current.project_id)
        transition.settle(run)
      }
    } catch (cause) {
      if (run !== null) transition.finish(run)
      if (disposed || request.signal.aborted) return
      if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) {
        removeVisit(scope, project.project_id)
        onUnavailable?.(project.project_id)
      }
      if (cause instanceof ApiError && cause.status === 401) {
        clearCredential()
        auth.user = null
        auth.requestLogin('/projects', '登录已过期，请重新登录。')
        void router.push('/')
        return
      }
      projectName.value = project.name
      explanation.value =
        cause instanceof ApiError && cause.status === 403
          ? '你暂无该项目的访问权限，请联系项目负责人或禅道管理员。'
          : cause instanceof ApiError && cause.status === 404
            ? '项目不存在或已不可访问。'
            : '暂时无法确认项目权限，请稍后重试。你的登录状态已保留。'
      dialogOpen.value = true
    } finally {
      navigating = false
      if (!disposed) openingId.value = null
    }
  }
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
    if (!navigating && run !== null) transition.finish(run)
  })
  return { openingId, explanation, projectName, dialogOpen, open }
}

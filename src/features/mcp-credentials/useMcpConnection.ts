import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api'
import { readMcpConnection, type McpConnection } from './source'

export function useMcpConnection() {
  const auth = useAuthStore()
  const info = shallowRef<McpConnection | null>(null)
  const loading = ref(false),
    error = ref('')
  let request: AbortController | undefined
  let disposed = false
  async function load() {
    if (!auth.user || disposed) return
    request?.abort()
    const controller = new AbortController(),
      owner = auth.user.id
    request = controller
    loading.value = true
    error.value = ''
    try {
      const result = await readMcpConnection(controller.signal)
      if (!controller.signal.aborted && auth.user?.id === owner && !disposed) info.value = result
    } catch (cause) {
      if (!controller.signal.aborted && auth.user?.id === owner && !disposed) {
        info.value = null
        error.value = '连接信息暂时无法读取，请重试。'
        if (cause instanceof ApiError && cause.status === 401) {
          auth.signOut()
          auth.requestLogin('/settings/mcp', '登录已过期，请重新登录。')
        }
      }
    } finally {
      if (request === controller) loading.value = false
    }
  }
  function clear() {
    request?.abort()
    request = undefined
    info.value = null
    loading.value = false
    error.value = ''
  }
  watch(
    () => auth.user?.id,
    () => {
      clear()
      void load()
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    clear()
  })
  return { info, loading, error, load }
}

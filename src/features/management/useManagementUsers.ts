import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { listManagementUsers, type ManagementUsers } from './users'

export function useManagementUsers() {
  const auth = useAuthStore()
  const query = ref(''),
    page = ref(1),
    data = ref<ManagementUsers | null>(null)
  const loading = ref(false),
    error = ref('')
  let controller: AbortController | undefined
  async function load(reset = false) {
    if (reset) page.value = 1
    controller?.abort()
    data.value = null
    if (!auth.canManageProjects) return
    const request = (controller = new AbortController())
    loading.value = true
    error.value = ''
    try {
      const result = await listManagementUsers(
        { page: page.value, limit: 20, q: query.value },
        request.signal,
      )
      if (request.signal.aborted || !auth.canManageProjects) return
      if (
        !result.items.length &&
        result.total > 0 &&
        page.value > Math.ceil(result.total / result.limit)
      ) {
        page.value = Math.ceil(result.total / result.limit)
        return await load()
      }
      data.value = result
    } catch (cause) {
      if (request.signal.aborted) return
      if (cause instanceof ApiError && [401, 403, 404].includes(cause.status ?? 0))
        auth.revokeManagement()
      error.value = '暂时无法读取用户列表，请稍后重试。'
    } finally {
      if (!request.signal.aborted) loading.value = false
    }
  }
  function changePage(value: number) {
    page.value = value
    void load()
  }
  watch(
    () => auth.canManageProjects,
    (allowed) => {
      if (!allowed) {
        controller?.abort()
        data.value = null
        error.value = ''
        loading.value = false
      }
    },
    { flush: 'sync' },
  )
  onMounted(() => void load())
  onScopeDispose(() => controller?.abort())
  return { query, page, data, loading, error, load, changePage }
}

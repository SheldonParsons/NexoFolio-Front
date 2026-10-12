import { onMounted, onScopeDispose, ref } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { managementError } from '@/features/projects/management/api'
import { listManagementProjects, type ManagementPage } from './projects'
export function useManagementProjects() {
  const auth = useAuthStore()
  const query = ref(''),
    origin = ref(''),
    page = ref(1),
    data = ref<ManagementPage | null>(null)
  const loading = ref(false),
    error = ref('')
  let controller: AbortController | undefined
  async function load(reset = false) {
    if (reset) page.value = 1
    controller?.abort()
    const request = (controller = new AbortController())
    loading.value = true
    error.value = ''
    data.value = null
    try {
      const result = await listManagementProjects(
        { page: page.value, limit: 20, q: query.value, origin: origin.value },
        request.signal,
      )
      if (request.signal.aborted) return
      if (!result.items.length && result.total > 0 && page.value > Math.ceil(result.total / 20)) {
        page.value = Math.ceil(result.total / 20)
        return await load()
      }
      data.value = result
    } catch (cause) {
      if (request.signal.aborted) return
      error.value = managementError(cause)
      if (cause instanceof ApiError && [403, 404].includes(cause.status ?? 0))
        auth.revokeManagement()
    } finally {
      if (!request.signal.aborted) loading.value = false
    }
  }
  function changePage(value: number) {
    page.value = value
    void load()
  }
  onMounted(() => void load())
  onScopeDispose(() => controller?.abort())
  return { query, origin, page, data, loading, error, load, changePage }
}

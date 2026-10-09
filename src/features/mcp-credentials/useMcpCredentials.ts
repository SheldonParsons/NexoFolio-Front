import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import * as source from './source'

/** Page-scoped state: secrets never enter persistent storage or a shared store. */
export function useMcpCredentials() {
  const auth = useAuthStore()
  const listing = shallowRef<source.CredentialPage | null>(null)
  const created = shallowRef<source.CreatedCredential | null>(null)
  const loading = ref(false),
    saving = ref(false),
    revoking = ref(false)
  const loadError = ref(''),
    createError = ref(''),
    revokeError = ref('')
  let read: AbortController | undefined, write: AbortController | undefined
  let disposed = false
  const owner = () => auth.user?.id ?? ''
  function errorMessage(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      auth.signOut()
      auth.requestLogin('/settings/mcp', '登录已过期，请重新登录。')
    }
    return error instanceof Error ? error.message : '请求失败，请稍后重试。'
  }
  async function load(page = listing.value?.page ?? 1) {
    if (!owner() || disposed) return
    read?.abort()
    const controller = new AbortController(),
      id = owner()
    read = controller
    loading.value = true
    loadError.value = ''
    try {
      const value = await source.readCredentials(page, controller.signal)
      if (!controller.signal.aborted && owner() === id && !disposed) listing.value = value
    } catch (error) {
      if (!controller.signal.aborted && owner() === id && !disposed)
        loadError.value = errorMessage(error)
    } finally {
      if (read === controller) loading.value = false
    }
  }
  async function create(input: source.CreateCredential) {
    if (!owner() || disposed || saving.value || revoking.value) return false
    const id = owner(),
      controller = new AbortController()
    write = controller
    saving.value = true
    createError.value = ''
    created.value = null
    try {
      const value = await source.createCredential(input, controller.signal)
      if (controller.signal.aborted || owner() !== id || disposed) return false
      created.value = value
      await load(1)
      return !!created.value
    } catch (error) {
      if (!controller.signal.aborted && owner() === id && !disposed) {
        const message = errorMessage(error)
        if (owner() !== id) return false
        const uncertain =
          !(error instanceof ApiError) || error.kind !== 'http' || (error.status ?? 500) >= 500
        createError.value = uncertain
          ? '未能确认创建结果，请关闭弹窗后刷新列表核对。如出现刚创建的凭证，请先撤销再重新创建；完整 token 无法再次查看。'
          : message
        // Reconcile the list without replaying a possibly completed POST.
        if (uncertain) await load(1)
      }
      return false
    } finally {
      if (write === controller) saving.value = false
    }
  }
  async function revoke(id: string) {
    if (!owner() || disposed || saving.value || revoking.value) return false
    const user = owner(),
      controller = new AbortController()
    write = controller
    revoking.value = true
    revokeError.value = ''
    try {
      await source.revokeCredential(id, controller.signal)
      if (controller.signal.aborted || owner() !== user || disposed) return false
      if (created.value?.credential.id === id) created.value = null
      if (listing.value) {
        listing.value = {
          ...listing.value,
          items: listing.value.items.map((item) =>
            item.id === id ? { ...item, status: 'revoked' } : item,
          ),
        }
      }
      await load()
      return true
    } catch (error) {
      if (!controller.signal.aborted && owner() === user && !disposed) {
        revokeError.value = errorMessage(error)
        if (owner() === user) {
          await load()
          if (listing.value?.items.some((item) => item.id === id && item.status === 'revoked'))
            return true
        }
      }
      return false
    } finally {
      if (write === controller) revoking.value = false
    }
  }
  function clear() {
    read?.abort()
    write?.abort()
    read = undefined
    write = undefined
    listing.value = null
    created.value = null
    loading.value = false
    saving.value = false
    revoking.value = false
    loadError.value = ''
    createError.value = ''
    revokeError.value = ''
  }
  watch(
    owner,
    () => {
      clear()
      if (owner()) void load(1)
    },
    { immediate: true, flush: 'sync' },
  )
  onScopeDispose(() => {
    disposed = true
    clear()
  })
  return {
    listing,
    created,
    loading,
    saving,
    revoking,
    loadError,
    createError,
    revokeError,
    load,
    create,
    revoke,
  }
}

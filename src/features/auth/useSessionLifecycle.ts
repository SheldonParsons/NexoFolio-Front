import { onMounted, onScopeDispose, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { readCredential } from '@/api/session'

/** Identity stays server-verified; browser storage supplies only a bearer credential. */
export function useSessionLifecycle() {
  const auth = useAuthStore()
  let expiry: ReturnType<typeof setTimeout> | undefined
  let refresh: ReturnType<typeof setInterval> | undefined
  let credential = readCredential()?.token
  const cleared = () => {
    credential = undefined
    auth.forgetSession()
  }
  async function validate() {
    const current = readCredential()
    if (current?.token !== credential) {
      auth.forgetSession()
      credential = current?.token
    }
    if (!current) {
      if (auth.user) auth.forgetSession()
      return
    }
    try {
      await auth.checkSession()
    } catch {
      auth.revokeManagement()
    }
  }
  function stored(event: StorageEvent) {
    if (event.key === 'nexofolio.session' || event.key === null) {
      auth.forgetSession()
      credential = readCredential()?.token
      void validate()
    }
  }
  function visible() {
    if (document.visibilityState === 'visible') void validate()
  }
  watch(
    () => auth.user,
    () => {
      clearTimeout(expiry)
      const current = readCredential()
      credential = current?.token
      if (current)
        expiry = setTimeout(
          () => void validate(),
          Math.min(2147483647, Math.max(0, Date.parse(current.expiresAt) - Date.now()) + 5),
        )
    },
    { immediate: true },
  )
  onMounted(() => {
    window.addEventListener('nexofolio:session-cleared', cleared)
    window.addEventListener('storage', stored)
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    if (!auth.user) void validate()
    refresh = setInterval(() => {
      if (auth.canManageProjects && document.visibilityState === 'visible') void validate()
    }, 30000)
  })
  onScopeDispose(() => {
    clearTimeout(expiry)
    clearInterval(refresh)
    window.removeEventListener('nexofolio:session-cleared', cleared)
    window.removeEventListener('storage', stored)
    window.removeEventListener('focus', visible)
    document.removeEventListener('visibilitychange', visible)
  })
}

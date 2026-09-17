import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getCurrentUser, type UserProfile } from '@/api/auth'
import { clearCredential } from '@/api/session'
import { clearBrowserViews } from '@/features/projects/browserState'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)
  const checking = ref(false)
  const loginOpen = ref(false)
  const destination = ref('/projects')
  const entryError = ref('')
  const notice = ref('')
  const arrival = ref<{ runId: number; userId: string } | null>(null)
  let arrivalSequence = 0
  function beginArrival() {
    if (user.value) arrival.value = { runId: ++arrivalSequence, userId: user.value.id }
  }
  function finishArrival(runId: number) {
    if (arrival.value?.runId === runId) arrival.value = null
  }
  const displayName = computed(() => user.value?.display_name || user.value?.account || '')
  let pending: Promise<boolean> | null = null
  function checkSession() {
    if (pending) return pending
    checking.value = true
    pending = getCurrentUser()
      .then((result) => {
        user.value = result
        return result !== null
      })
      .finally(() => {
        checking.value = false
        pending = null
      })
    return pending
  }
  function requestLogin(target = '/projects', error = '') {
    destination.value = target
    entryError.value = error
    loginOpen.value = true
  }
  function signOut() {
    clearBrowserViews()
    arrival.value = null
    clearCredential()
    user.value = null
    loginOpen.value = false
  }
  return {
    user,
    checking,
    loginOpen,
    destination,
    entryError,
    notice,
    arrival,
    beginArrival,
    finishArrival,
    displayName,
    checkSession,
    requestLogin,
    signOut,
  }
})

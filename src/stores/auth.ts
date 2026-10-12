import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getCurrentUser, authenticatedUser, type UserProfile } from '@/api/auth'
import { clearCredential, readCredential } from '@/api/session'
import { clearBrowserViews } from '@/features/projects/browserState'
import { useProjectContextStore } from './projectContext'

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
  const canManageProjects = computed(
    () =>
      user.value?.enabled === true &&
      user.value.account.toLowerCase() === 'a80646' &&
      user.value.can_manage_projects === true,
  )
  function updateProfile(profile: UserProfile) {
    const sameIdentity =
      user.value?.id === profile.id &&
      user.value.account.toLowerCase() === profile.account.toLowerCase()
    user.value = authenticatedUser(profile, {
      manage_projects: sameIdentity && user.value?.can_manage_projects === true,
    })
  }
  let pending: { token: string | undefined; task: Promise<boolean> } | null = null
  let generation = 0
  function revokeManagement() {
    if (user.value) user.value = { ...user.value, can_manage_projects: false }
  }
  function forgetSession() {
    generation++
    pending = null
    user.value = null
    arrival.value = null
    useProjectContextStore().clear()
    clearBrowserViews()
  }
  function checkSession() {
    const token = readCredential()?.token
    if (pending?.token === token && pending) return pending.task
    const run = generation
    checking.value = true
    const task = getCurrentUser()
      .then((result) => {
        if (run !== generation || readCredential()?.token !== token) return false
        user.value = result
        return result !== null
      })
      .catch((error) => {
        if (run === generation && readCredential()?.token === token) revokeManagement()
        throw error
      })
      .finally(() => {
        if (pending?.task === task) {
          checking.value = false
          pending = null
        }
      })
    pending = { token, task }
    return task
  }
  function requestLogin(target = '/projects', error = '') {
    destination.value = target
    entryError.value = error
    loginOpen.value = true
  }
  function signOut() {
    forgetSession()
    useProjectContextStore().clear()
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
    canManageProjects,
    revokeManagement,
    forgetSession,
    updateProfile,
    checkSession,
    requestLogin,
    signOut,
  }
})

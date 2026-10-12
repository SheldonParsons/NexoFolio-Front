import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/api'
import * as source from './source'
export const usePersonalProfile = defineStore('personal-profile', () => {
  const auth = useAuthStore()
  const profile = shallowRef<source.PersonalProfile | null>(null),
    loading = ref(false),
    saving = ref(false),
    error = ref('')
  let read: AbortController | undefined, write: AbortController | undefined
  let pending: Promise<void> | undefined
  const owner = () => auth.user?.id ?? ''
  function accept(value: source.PersonalProfile, id: string) {
    if (owner() !== id || value.user.id !== id) return
    profile.value = value
    auth.updateProfile(value.user)
  }
  function report(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      auth.user = null
      auth.requestLogin('/projects', '登录已过期，请重新登录')
      return
    }
    error.value = cause instanceof Error ? cause.message : '暂时无法保存资料'
  }
  function load(force = false) {
    if (!owner() || (!force && profile.value?.user.id === owner())) return Promise.resolve()
    if (pending) return pending
    const id = owner()
    const controller = new AbortController()
    read = controller
    const signal = controller.signal
    loading.value = true
    error.value = ''
    pending = source
      .readProfile(signal)
      .then((value) => {
        if (!signal.aborted) accept(value, id)
      })
      .catch((cause) => {
        if (!signal.aborted && owner() === id) report(cause)
      })
      .finally(() => {
        if (read === controller) {
          loading.value = false
          pending = undefined
        }
      })
    return pending
  }
  async function save(
    action: 'text' | 'avatar',
    displayName: string | null,
    bio: string,
    avatar: string | null,
  ) {
    if (saving.value || !profile.value || !owner()) return false
    const id = owner(),
      version = profile.value.version
    write = new AbortController()
    const signal = write.signal
    saving.value = true
    error.value = ''
    try {
      const value =
        action === 'text'
          ? await source.updateProfile(displayName, bio, version, signal)
          : await source.updateAvatar(avatar, version, signal)
      if (signal.aborted || owner() !== id) return false
      accept(value, id)
      return true
    } catch (cause) {
      if (!signal.aborted && owner() === id) {
        // Never replay an uncertain POST. Read the saved version and reconcile.
        try {
          const value = await source.readProfile(signal)
          const matches =
            action === 'text'
              ? value.display_name_override === displayName && value.bio === bio
              : (value.user.avatar_url ?? null) === avatar
          if (value.version > version && matches) {
            accept(value, id)
            return true
          }
        } catch {
          /* Keep the original save error and the user's draft. */
        }
        report(cause)
      }
      return false
    } finally {
      if (owner() === id) saving.value = false
    }
  }
  watch(owner, () => {
    read?.abort()
    write?.abort()
    pending = undefined
    profile.value = null
    loading.value = false
    saving.value = false
    error.value = ''
    if (owner()) void load()
  })
  return {
    profile,
    loading,
    saving,
    error,
    ready: computed(() => !!profile.value),
    load,
    saveText: (name: string | null, bio: string) =>
      save('text', name?.trim() || null, bio.trim(), null),
    saveAvatar: (url: string | null) => save('avatar', null, '', url),
  }
})

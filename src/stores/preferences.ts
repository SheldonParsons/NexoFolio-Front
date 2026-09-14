import { computed, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemePreference = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'nexofolio.theme'

function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<ThemePreference>(readTheme())
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const systemDark = ref(media.matches)
  const resolvedTheme = computed(() =>
    theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value,
  )
  const onSystemChange = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) theme.value = readTheme()
  }
  media.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  onScopeDispose(() => {
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  })

  watch(
    resolvedTheme,
    (value) => {
      document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )
  watch(theme, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* Browsing remains usable when storage is disabled. */
    }
  })

  function setTheme(value: ThemePreference) {
    theme.value = value
  }
  function toggleTheme() {
    setTheme(resolvedTheme.value === 'light' ? 'dark' : 'light')
  }
  return { theme, resolvedTheme, setTheme, toggleTheme }
})

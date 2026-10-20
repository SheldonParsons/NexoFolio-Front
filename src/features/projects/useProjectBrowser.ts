import { ApiError } from '@/api'
import { computed, onScopeDispose, ref } from 'vue'
import type { Project, ProjectListQuery, ProjectSource } from './types'
import { browserViewGeneration, readBrowserView, saveBrowserView } from './browserState'
import { resolveRecent } from './recent'

export function useProjectBrowser(source: ProjectSource, scope: string) {
  const saved = readBrowserView(scope)
  const owner = browserViewGeneration()
  const query = ref(saved.query)
  const page = ref(saved.page)
  const items = ref(saved.result?.items ?? [])
  const total = ref(saved.result?.total ?? 0)
  const hasResult = ref(!!saved.result)
  const recent = ref<Project[]>([])
  const recentReady = ref(false)
  const loading = ref(false)
  const pendingInput = ref(false)
  const showProgress = ref(false)
  const error = ref<unknown>(null)
  const revision = ref(0)
  const scrollTop = ref(saved.scrollTop)
  const restoreScroll = ref(saved.scrollTop > 0)
  const limit = 10
  let controller: AbortController | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let progressTimer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0
  let disposed = false
  let composing = false
  const activeFilters = computed(() => !!query.value.trim())
  const busy = computed(() => loading.value || pendingInput.value)
  const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
  let committed = saved.result
  let validatedAt = saved.validatedAt ?? 0
  function persist() {
    saveBrowserView(
      scope,
      {
        query: query.value,
        page: page.value,
        scrollTop: scrollTop.value,
        result: committed,
        validatedAt,
      },
      owner,
    )
  }
  async function load(resetScroll = false) {
    clearTimeout(debounce)
    pendingInput.value = false
    controller?.abort()
    const current = ++sequence
    const request = new AbortController()
    controller = request
    loading.value = true
    error.value = null
    showProgress.value = false
    clearTimeout(progressTimer)
    progressTimer = setTimeout(() => {
      if (current === sequence) showProgress.value = true
    }, 120)
    const params: ProjectListQuery = { page: page.value, limit }
    if (query.value.trim()) params.q = query.value.trim()
    try {
      const result = await source.list(params, request.signal)
      if (disposed || current !== sequence || request.signal.aborted) return
      const lastPage = Math.max(1, Math.ceil(result.total / limit))
      if (page.value > lastPage) {
        page.value = lastPage
        return await load(true)
      }
      items.value = result.items
      total.value = result.total
      hasResult.value = true
      committed = result
      validatedAt = Date.now()
      if (resetScroll) {
        scrollTop.value = 0
        restoreScroll.value = true
      }
      revision.value++
      persist()
      if (activeFilters.value) return
      // Convenience data does not delay the main result or keep the UI busy.
      void resolveRecent(scope, source, result.items, request.signal)
        .then((value) => {
          if (!disposed && current === sequence && !request.signal.aborted) {
            recent.value = value
            recentReady.value = true
          }
        })
        .catch((cause) => {
          if (!disposed && current === sequence) {
            if (cause instanceof ApiError && cause.status === 401) error.value = cause
            recentReady.value = true
          }
        })
    } catch (cause) {
      if (!disposed && current === sequence && !request.signal.aborted) error.value = cause
    } finally {
      if (current === sequence) {
        loading.value = false
        showProgress.value = false
        clearTimeout(progressTimer)
      }
    }
  }
  function invalidateInput() {
    clearTimeout(debounce)
    clearTimeout(progressTimer)
    controller?.abort()
    ++sequence
    loading.value = false
    showProgress.value = false
    pendingInput.value = true
    error.value = null
  }
  function changeQuery(value: string) {
    query.value = value
    invalidateInput()
    if (!composing)
      debounce = setTimeout(() => {
        page.value = 1
        void load(true)
      }, 250)
  }
  function submitQuery() {
    if (composing) return
    page.value = 1
    void load(true)
  }
  function clearQuery() {
    query.value = ''
    page.value = 1
    void load(true)
  }
  function changePage(value: number) {
    if (busy.value || value < 1 || value > pages.value) return
    page.value = value
    void load(true)
  }
  function compositionStart() {
    composing = true
    invalidateInput()
  }
  function compositionEnd(value: string) {
    composing = false
    changeQuery(value)
  }
  onScopeDispose(() => {
    disposed = true
    controller?.abort()
    clearTimeout(debounce)
    clearTimeout(progressTimer)
    persist()
  })
  return {
    query,
    page,
    items,
    total,
    recent,
    recentReady,
    hasResult,
    busy,
    showProgress,
    error,
    revision,
    scrollTop,
    restoreScroll,
    activeFilters,
    pages,
    limit,
    load,
    changeQuery,
    submitQuery,
    clearQuery,
    changePage,
    compositionStart,
    compositionEnd,
    persist,
  }
}

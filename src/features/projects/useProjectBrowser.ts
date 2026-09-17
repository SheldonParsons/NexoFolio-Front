import { computed, onScopeDispose, ref } from 'vue'
import type { Project, ProjectAccess, ProjectListQuery, ProjectSource } from './types'
import { browserViewGeneration, readBrowserView, saveBrowserView } from './browserState'
import { resolveRecent } from './recent'

export function useProjectBrowser(source: ProjectSource, scope: string, supportsQuery: boolean) {
  const saved = readBrowserView(scope)
  const owner = browserViewGeneration()
  const query = ref(supportsQuery ? saved.query : '')
  const access = ref<ProjectAccess | 'all'>(supportsQuery ? saved.access : 'all')
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
  const activeFilters = computed(() => !!query.value.trim() || access.value !== 'all')
  const busy = computed(() => loading.value || pendingInput.value)
  const pages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
  let committed = saved.result
  function persist() {
    saveBrowserView(
      scope,
      {
        query: query.value,
        access: access.value,
        page: page.value,
        scrollTop: scrollTop.value,
        result: committed,
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
    if (supportsQuery && query.value.trim()) params.q = query.value.trim()
    if (supportsQuery && access.value !== 'all') params.access_state = access.value
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
      if (resetScroll) {
        scrollTop.value = 0
        restoreScroll.value = true
      }
      revision.value++
      persist()
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
            error.value = cause
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
  function changeAccess(value: ProjectAccess | 'all') {
    access.value = value
    page.value = 1
    void load(true)
  }
  function clearQuery() {
    query.value = ''
    page.value = 1
    void load(true)
  }
  function resetFilters() {
    query.value = ''
    access.value = 'all'
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
    access,
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
    resetFilters,
    changeAccess,
    changePage,
    compositionStart,
    compositionEnd,
    persist,
  }
}

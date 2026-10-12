import { onMounted, onScopeDispose, ref, watch } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { accessReport, type AccessReport, type AccessRow } from './analysis'
export function useAccessAnalysis() {
  const auth = useAuthStore()
  const kind = ref('page'),
    days = ref('7'),
    pageGroup = ref('all'),
    project = ref(''),
    background = ref(false),
    page = ref(1),
    report = ref<AccessReport | null>(null),
    busy = ref(false),
    error = ref('')
  let controller: AbortController | undefined
  let range = { since: '', until: '' }
  function query(view: 'ranking' | 'visits' = 'ranking', row?: AccessRow) {
    const q = new URLSearchParams({
      ...range,
      kind: kind.value,
      view,
      page: String(page.value),
      limit: '20',
      background: String(background.value),
    })
    if (kind.value === 'page' && pageGroup.value !== 'all') q.set('page_group', pageGroup.value)
    if (project.value) q.set('project', project.value)
    if (row)
      for (const key of ['project', 'resource', 'route', 'action', 'method'] as const)
        if (typeof row[key] === 'string') q.set(key, row[key])
    return q
  }
  async function load(reset = true) {
    if (reset) {
      page.value = 1
      range = {
        since: new Date(Date.now() - Number(days.value) * 86400000).toISOString(),
        until: new Date().toISOString(),
      }
    }
    controller?.abort()
    const request = (controller = new AbortController())
    busy.value = true
    error.value = ''
    report.value = null
    try {
      const result = await accessReport(query(), request.signal)
      if (!request.signal.aborted) report.value = result
    } catch (e) {
      if (request.signal.aborted) return
      if (e instanceof ApiError && [401, 403, 404].includes(e.status || 0)) auth.revokeManagement()
      error.value = e instanceof Error ? e.message : '访问分析读取失败'
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  }
  function move(value: number) {
    page.value = value
    void load(false)
  }
  watch([kind, days, project, background, pageGroup], () => void load())
  onMounted(() => void load())
  onScopeDispose(() => controller?.abort())
  return {
    kind,
    pageGroup,
    days,
    project,
    background,
    page,
    report,
    busy,
    error,
    query,
    load,
    move,
  }
}

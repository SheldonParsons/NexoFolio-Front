import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { api } from '@/api'
import { useCurationPanel } from '@/features/curation/useCurationPanel'
import { useReviewProgress } from '@/features/curation/useReviewProgress'
import { useCurationReview } from '@/features/curation/useCurationReview'
import { createDownloadCatalog } from '@/features/downloads/useDownloads'
import type { CurateProgress } from '@/contracts/knowledge/types'

vi.mock('@/features/projects/source', () => ({
  projectSource: { get: async () => ({ project_id: 'p' }) },
}))

const scopes: ReturnType<typeof effectScope>[] = []
let page: EventTarget & { hidden: boolean; visibilityState: string }
const job: CurateProgress = {
  status: 'running',
  stage: 'fields',
  candidate_id: 'c',
  run_id: 'r',
  total: 10,
  completed: 0,
  generated: 0,
  unchanged: 0,
  fields_updated: 0,
  message: null,
}
const row = { id: 'c', project_id: 'p', state: 'running', progress: job }
beforeEach(() => {
  vi.useFakeTimers()
  page = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible' })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function mount(running: boolean) {
  const scope = effectScope()
  scopes.push(scope)
  scope.run(() => {
    useCurationPanel(
      () => 'p',
      () => 'page',
      () => null,
      () => false,
      vi.fn(),
    )
    if (running) void useReviewProgress(() => 'p', vi.fn()).observe(job)
  })
}
it.each([
  ['idle-5m', false, false, 1],
  ['running-5m', true, false, 1],
  ['hidden-5m-return', true, true, 1],
  ['two-observers-running-5m', true, false, 2],
  ['two-overlapping-observers-running-5m', true, false, 2],
] as const)('records actual read calls: %s', async (scenario, running, hidden, consumers) => {
  const requests: string[] = []
  vi.spyOn(api, 'request').mockImplementation(async (path) => {
    requests.push(path)
    if (scenario.includes('overlapping')) await new Promise((resolve) => setTimeout(resolve, 25))
    return (path.includes('/candidates') ? (running ? [row] : []) : job) as never
  })
  for (let i = 0; i < consumers; i++) mount(running)
  await vi.advanceTimersByTimeAsync(0)
  const initial = requests.length
  if (hidden) {
    page.hidden = true
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange'))
  }
  await vi.advanceTimersByTimeAsync(300_000)
  const during = requests.length - initial
  if (hidden) {
    page.hidden = false
    page.visibilityState = 'visible'
    page.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
  }
  const result = {
    scenario,
    initial,
    during,
    afterReturn: requests.length - initial - during,
    candidates: requests.filter((p) => p.includes('/candidates')).length,
    progress: requests.filter((p) => !p.includes('/candidates')).length,
  }
  console.log('QUERY_COUNTS', JSON.stringify(result))
  expect(requests.length).toBeGreaterThan(0)
  scopes.splice(0).forEach((s) => s.stop())
  const stopped = requests.length
  await vi.advanceTimersByTimeAsync(60_000)
  expect(requests).toHaveLength(stopped)
})
it('records repeated download channel selection', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) =>
    Response.json({
      schema_version: 1,
      desktop_channel: String(input).endsWith('public') ? 'public' : 'internal',
      fetcher: { status: 'unpublished', release: null },
      desktop: ['windows', 'mac-arm64', 'mac-x64'].map((platform) => ({
        platform,
        status: 'unpublished',
        release: null,
      })),
    }),
  )
  const catalog = createDownloadCatalog(fetcher)
  await catalog.refresh()
  await catalog.selectChannel('public')
  await catalog.selectChannel('internal')
  await catalog.selectChannel('public')
  console.log(
    'QUERY_COUNTS',
    JSON.stringify({ scenario: 'four-download-reads', requests: fetcher.mock.calls.length }),
  )
})
it.each([false, true])(
  'records review discovery and lifecycle reads (hidden running=%s)',
  async (hidden) => {
    const requests: string[] = []
    vi.spyOn(api, 'request').mockImplementation(async (path) => {
      requests.push(path)
      return (
        path.endsWith('/candidates') ? (hidden ? [row] : []) : { version: 1, decisions: [] }
      ) as never
    })
    const scope = effectScope()
    scopes.push(scope)
    scope.run(() =>
      useCurationReview(
        () => 'p',
        () => '',
        vi.fn(),
      ),
    )
    await vi.advanceTimersByTimeAsync(0)
    const initial = requests.length
    if (hidden) {
      page.hidden = true
      page.visibilityState = 'hidden'
      page.dispatchEvent(new Event('visibilitychange'))
    }
    await vi.advanceTimersByTimeAsync(300000)
    console.log(
      'QUERY_COUNTS',
      JSON.stringify({
        scenario: hidden ? 'review-running-hidden-5m' : 'review-idle-5m',
        initial,
        during: requests.length - initial,
        candidates: requests.filter((p) => p.endsWith('/candidates')).length,
        lifecycle: requests.filter((p) => p.endsWith('/document-lifecycle')).length,
      }),
    )
  },
)

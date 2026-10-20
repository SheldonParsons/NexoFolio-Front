import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDownloadCatalog } from '@/features/downloads/useDownloads'
let page: EventTarget & { hidden: boolean }
const releases: (() => void)[] = []
const response = (channel: string, error = false, fetcherChannel = 'internal') => ({
  schema_version: 1,
  desktop_channel: channel,
  fetcher_channel: fetcherChannel,
  fetcher: { status: error ? 'error' : 'unpublished', release: null },
  desktop: ['windows', 'mac-arm64', 'mac-x64'].map((platform) => ({
    platform,
    status: 'unpublished',
    release: null,
  })),
})
const fetcher = () =>
  vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const query = new URL(String(input), 'https://site.test').searchParams
    return Response.json(
      response(query.get('desktop_channel')!, false, query.get('fetcher_channel')!),
    )
  })
beforeEach(() => {
  vi.useFakeTimers()
  page = Object.assign(new EventTarget(), { hidden: false })
  vi.stubGlobal('document', page)
  vi.stubGlobal('window', new EventTarget())
})
afterEach(() => {
  releases.splice(0).forEach((fn) => fn())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const flush = () => vi.advanceTimersByTimeAsync(0)
it('shares one refresh schedule for staggered mounts, stops after last release, and resumes from freshness', async () => {
  const request = fetcher(),
    catalog = createDownloadCatalog(request)
  const first = catalog.observe()
  releases.push(first)
  await flush()
  await vi.advanceTimersByTimeAsync(60000)
  const second = catalog.observe()
  releases.push(second)
  await flush()
  expect(request).toHaveBeenCalledTimes(1)
  first()
  await vi.advanceTimersByTimeAsync(239999)
  expect(request).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(request).toHaveBeenCalledTimes(2)
  second()
  await vi.advanceTimersByTimeAsync(300000)
  expect(request).toHaveBeenCalledTimes(2)
  releases.push(catalog.observe())
  await flush()
  expect(request).toHaveBeenCalledTimes(3)
})
it('isolates channel freshness and lets explicit refresh bypass it', async () => {
  const request = fetcher(),
    catalog = createDownloadCatalog(request)
  await catalog.selectChannel('internal')
  await catalog.selectChannel('public')
  await catalog.selectChannel('internal')
  await catalog.selectChannel('public')
  expect(request).toHaveBeenCalledTimes(2)
  await catalog.refresh()
  expect(request).toHaveBeenCalledTimes(3)
  await vi.advanceTimersByTimeAsync(300000)
  await catalog.selectChannel('internal')
  expect(request).toHaveBeenCalledTimes(4)
})
it('does not cache transport failures or a successful HTTP response containing error status', async () => {
  const request = fetcher(),
    catalog = createDownloadCatalog(request)
  request.mockResolvedValueOnce(new Response('', { status: 503 }))
  await catalog.selectChannel('internal')
  expect(catalog.state.fetcher.status).toBe('error')
  request.mockResolvedValueOnce(Response.json(response('internal', true)))
  await catalog.selectChannel('internal')
  await catalog.selectChannel('internal')
  expect(request).toHaveBeenCalledTimes(3)
  expect(catalog.state.fetcher.status).toBe('unpublished')
})
it('pauses hidden timers and checks immediately on return when expired', async () => {
  const request = fetcher(),
    catalog = createDownloadCatalog(request)
  releases.push(catalog.observe())
  await flush()
  page.hidden = true
  page.dispatchEvent(new Event('visibilitychange'))
  await vi.advanceTimersByTimeAsync(600000)
  expect(request).toHaveBeenCalledTimes(1)
  page.hidden = false
  page.dispatchEvent(new Event('visibilitychange'))
  await flush()
  expect(request).toHaveBeenCalledTimes(2)
  page.dispatchEvent(new Event('visibilitychange'))
  await flush()
  expect(request).toHaveBeenCalledTimes(2)
})
it('does not retain a global Fetcher error when switching back to a previously successful channel', async () => {
  const request = fetcher(),
    catalog = createDownloadCatalog(request)
  await catalog.selectChannel('internal')
  request.mockResolvedValueOnce(new Response('', { status: 503 }))
  await catalog.selectChannel('public')
  expect(catalog.state.fetcher.status).toBe('error')
  await catalog.selectChannel('internal')
  expect(request).toHaveBeenCalledTimes(3)
  expect(catalog.state.fetcher.status).toBe('unpublished')
})

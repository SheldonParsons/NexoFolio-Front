import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { createApiClient } from '@/api/client'
import {
  desktopPlatforms,
  parseDownloadsResponse,
  type DesktopChannel,
  type FetcherChannel,
  type FetcherRelease,
  type ReleaseArtifact,
  type ReleaseStatus,
} from './releases'

export type { DesktopChannel, FetcherChannel } from './releases'
type Status = 'idle' | 'loading' | ReleaseStatus
interface DownloadState<T> {
  status: Status
  release: T | null
}
export const desktopChannels: { id: DesktopChannel; label: string }[] = [
  { id: 'internal', label: 'Gree 内部版' },
  { id: 'public', label: '公网版' },
]
const platformStates = () =>
  desktopPlatforms.map((platform) => ({
    ...platform,
    status: 'idle' as Status,
    release: null as ReleaseArtifact | null,
  }))

export function createDownloadCatalog(fetcher: typeof fetch = fetch) {
  // Same API base as the site; no OSS manifest requests, credentials or project-load tracking.
  const client = createApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    fetcher,
    timeoutMs: 10_000,
  })
  const state = reactive({
    fetcherChannel: 'internal' as FetcherChannel,
    fetchers: {
      internal: { status: 'idle', release: null } as DownloadState<FetcherRelease>,
      public: { status: 'idle', release: null } as DownloadState<FetcherRelease>,
    },
    get fetcher(): DownloadState<FetcherRelease> {
      return this.fetchers[this.fetcherChannel]
    },
    channel: 'internal' as DesktopChannel,
    desktop: { internal: platformStates(), public: platformStates() },
  })
  // Four fixed selection pairs, with independent ownership of each channel state.
  const pending = new Map<string, Promise<void>>()
  const checked = new Map<string, number>()
  const fetcherOwner = new Map<FetcherChannel, number>()
  const desktopOwner = new Map<DesktopChannel, number>()
  const interval = 5 * 60_000
  let consumers = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0
  const selectionKey = (channel: DesktopChannel, fetcherChannel: FetcherChannel) =>
    `${channel}:${fetcherChannel}`
  function schedule() {
    clearTimeout(timer)
    if (!consumers || document.hidden) return
    const at = checked.get(selectionKey(state.channel, state.fetcherChannel))
    timer = setTimeout(
      () => void refreshChannel(state.channel),
      at === undefined ? interval : Math.max(0, at + interval - Date.now()),
    )
  }
  function refreshChannel(
    channel: DesktopChannel,
    force = false,
    fetcherChannel: FetcherChannel = state.fetcherChannel,
  ): Promise<void> {
    const key = selectionKey(channel, fetcherChannel)
    const inflight = pending.get(key)
    if (inflight) return inflight
    const fetcherState = state.fetchers[fetcherChannel]
    const owner = state.desktop[channel]
    const at = checked.get(key)
    if (
      !force &&
      fetcherState.status !== 'error' &&
      owner.every((item) => item.status !== 'error') &&
      at !== undefined &&
      Date.now() - at < interval
    ) {
      schedule()
      return Promise.resolve()
    }
    checked.delete(key)
    const started = Date.now()
    const requestId = ++sequence
    fetcherOwner.set(fetcherChannel, requestId)
    desktopOwner.set(channel, requestId)
    owner.forEach((item) => {
      item.status = 'loading'
    })
    fetcherState.status = 'loading'
    const job = (async () => {
      try {
        const query = new URLSearchParams({
          desktop_channel: channel,
          fetcher_channel: fetcherChannel,
        })
        const data = parseDownloadsResponse(
          await client.request(`v1/downloads?${query}`, { credentials: 'omit', cache: 'no-store' }),
          channel,
          fetcherChannel,
        )
        if (desktopOwner.get(channel) === requestId) {
          for (const platform of owner) {
            const value = data.desktop.find((item) => item.id === platform.id)!
            platform.status = value.status
            platform.release = value.release
          }
        }
        if (fetcherOwner.get(fetcherChannel) === requestId)
          Object.assign(fetcherState, data.fetcher)
        if (
          data.fetcher.status !== 'error' &&
          data.desktop.every((item) => item.status !== 'error')
        )
          checked.set(key, started)
      } catch {
        if (desktopOwner.get(channel) === requestId) {
          owner.forEach((item) => {
            item.status = 'error'
            item.release = null
          })
        }
        if (fetcherOwner.get(fetcherChannel) === requestId)
          Object.assign(fetcherState, { status: 'error', release: null })
      } finally {
        pending.delete(key)
        schedule()
      }
    })()
    pending.set(key, job)
    return job
  }
  function refresh() {
    // Explicit "check again" always bypasses completed-result freshness.
    return refreshChannel(state.channel, true)
  }
  function selectChannel(channel: DesktopChannel) {
    if (channel !== 'internal' && channel !== 'public') return Promise.resolve()
    state.channel = channel
    return refreshChannel(channel)
  }
  function selectFetcherChannel(channel: FetcherChannel) {
    if (channel !== 'internal' && channel !== 'public') return Promise.resolve()
    state.fetcherChannel = channel
    return refreshChannel(state.channel)
  }
  function visible() {
    clearTimeout(timer)
    if (!document.hidden) void refreshChannel(state.channel)
  }
  function observe() {
    if (++consumers === 1) {
      document.addEventListener('visibilitychange', visible)
      window.addEventListener('online', visible)
    }
    visible()
    let released = false
    return () => {
      if (released) return
      released = true
      if (--consumers === 0) {
        clearTimeout(timer)
        document.removeEventListener('visibilitychange', visible)
        window.removeEventListener('online', visible)
      }
    }
  }
  return { state, refresh, selectChannel, selectFetcherChannel, observe }
}

const catalog = createDownloadCatalog()
export function useDownloads() {
  let release: (() => void) | undefined
  onMounted(() => {
    release = catalog.observe()
  })
  onBeforeUnmount(() => {
    release?.()
  })
  return catalog
}
export function downloadStatus(status: Status) {
  return status === 'unpublished' ? '待上传' : status === 'error' ? '暂不可用' : '检查中'
}

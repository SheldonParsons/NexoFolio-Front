import { onBeforeUnmount, onMounted, reactive } from 'vue'
import { createApiClient } from '@/api/client'
import {
  desktopPlatforms,
  parseDownloadsResponse,
  type DesktopChannel,
  type FetcherRelease,
  type ReleaseArtifact,
  type ReleaseStatus,
} from './releases'

export type { DesktopChannel } from './releases'
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
    fetcher: { status: 'idle', release: null } as DownloadState<FetcherRelease>,
    channel: 'internal' as DesktopChannel,
    desktop: { internal: platformStates(), public: platformStates() },
  })
  const pending = new Map<DesktopChannel, Promise<void>>()
  let sequence = 0
  function refreshChannel(channel: DesktopChannel): Promise<void> {
    const inflight = pending.get(channel)
    if (inflight) return inflight
    const owner = state.desktop[channel]
    const requestId = ++sequence
    owner.forEach((item) => {
      item.status = 'loading'
    })
    state.fetcher.status = 'loading'
    const job = (async () => {
      try {
        const query = new URLSearchParams({ desktop_channel: channel })
        const data = parseDownloadsResponse(
          await client.request(`v1/downloads?${query}`, { credentials: 'omit', cache: 'no-store' }),
          channel,
        )
        for (const platform of owner) {
          const value = data.desktop.find((item) => item.id === platform.id)!
          platform.status = value.status
          platform.release = value.release
        }
        if (requestId === sequence) Object.assign(state.fetcher, data.fetcher)
      } catch {
        owner.forEach((item) => {
          item.status = 'error'
          item.release = null
        })
        if (requestId === sequence) Object.assign(state.fetcher, { status: 'error', release: null })
      } finally {
        pending.delete(channel)
      }
    })()
    pending.set(channel, job)
    return job
  }
  function refresh() {
    return refreshChannel(state.channel)
  }
  function selectChannel(channel: DesktopChannel) {
    if (channel !== 'internal' && channel !== 'public') return Promise.resolve()
    state.channel = channel
    return refreshChannel(channel)
  }
  return { state, refresh, selectChannel }
}

const catalog = createDownloadCatalog()
export function useDownloads() {
  let timer: ReturnType<typeof setInterval> | undefined
  const refreshVisible = () => {
    if (document.visibilityState === 'visible') void catalog.refresh()
  }
  onMounted(() => {
    void catalog.refresh()
    timer = setInterval(refreshVisible, 5 * 60_000)
    document.addEventListener('visibilitychange', refreshVisible)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', refreshVisible)
  })
  return catalog
}
export function downloadStatus(status: Status) {
  return status === 'unpublished' ? '待上传' : status === 'error' ? '暂不可用' : '检查中'
}

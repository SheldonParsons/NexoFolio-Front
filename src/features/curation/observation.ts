import { onScopeDispose } from 'vue'

export const pageVisible = () => typeof document === 'undefined' || !document.hidden

/** A single owner for a component's timer and visible/online wakeups. Blur is irrelevant. */
export function useVisiblePolling(
  refresh: () => void,
  interval: () => number,
  enabled: () => boolean,
) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    clear()
    if (pageVisible() && enabled()) timer = setTimeout(refresh, interval())
  }
  const wake = () => {
    clear()
    if (pageVisible() && enabled()) refresh()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', wake)
  if (typeof window !== 'undefined') window.addEventListener('online', wake)
  onScopeDispose(() => {
    clear()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', wake)
    if (typeof window !== 'undefined') window.removeEventListener('online', wake)
  })
  return { schedule, clear }
}

/** Keep the foreground cadence; a hidden page waits for visibility instead of polling. */
export function waitForObservation(signal: AbortSignal, delay = 0): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason)
  if (pageVisible() && delay === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', cancel)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visible)
      if (typeof window !== 'undefined') window.removeEventListener('online', online)
    }
    const done = () => {
      cleanup()
      resolve()
    }
    const cancel = () => {
      cleanup()
      reject(signal.reason)
    }
    const visible = () => {
      clearTimeout(timer)
      if (pageVisible()) done()
    }
    const online = () => {
      if (pageVisible()) done()
    }
    signal.addEventListener('abort', cancel, { once: true })
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visible)
    if (typeof window !== 'undefined') window.addEventListener('online', online)
    if (pageVisible()) timer = setTimeout(done, delay)
  })
}

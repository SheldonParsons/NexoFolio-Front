import { api, apiBaseUrl, ApiError } from '@/api'
import { readCredential } from '@/api/session'

type Read = { controller: AbortController; promise: Promise<unknown>; consumers: number }
const pending = new Map<string, Read>()
const revisions = new Map<string, number>()
const listeners = new Set<(project: string) => void>()

/** Project document and curation GETs share only in-flight transport, fenced by identity and writes. */
export function readProject<T>(
  project: string,
  path: string,
  signal?: AbortSignal,
  runKey = '',
): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason)
  const token = readCredential()?.token
  const revision = revisions.get(project) ?? 0
  const key = JSON.stringify([apiBaseUrl, token, project, path, runKey, revision])
  let read = pending.get(key)
  if (!read) {
    const controller = new AbortController()
    read = {
      controller,
      consumers: 0,
      promise: api.request<T>(path, { signal: controller.signal, cache: 'no-store' }),
    }
    pending.set(key, read)
    const release = () => {
      if (pending.get(key) === read) pending.delete(key)
    }
    void read.promise.then(release, release)
  }
  const shared = read
  shared.consumers++
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return false
      settled = true
      signal?.removeEventListener('abort', cancel)
      if (--shared.consumers === 0 && pending.get(key) === shared) {
        pending.delete(key)
        shared.controller.abort()
      }
      return true
    }
    const cancel = () => {
      if (finish()) reject(signal?.reason)
    }
    signal?.addEventListener('abort', cancel, { once: true })
    void shared.promise.then(
      (value) => {
        if (!finish()) return
        if (readCredential()?.token !== token || (revisions.get(project) ?? 0) !== revision)
          reject(new ApiError('项目状态或登录身份已变化，请重新读取。', 'network'))
        else resolve(value as T)
      },
      (cause) => {
        if (finish()) reject(cause)
      },
    )
  })
}

// Preserve the curation port; documents use the same cancellation and revision boundary.
export const readCuration = readProject

export function onCurationChanged(listener: (project: string) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Fence pre-write reads, then reconcile even an uncertain write without replaying it. */
export async function changeCuration<T>(project: string, action: () => Promise<T>): Promise<T> {
  const invalidate = () => revisions.set(project, (revisions.get(project) ?? 0) + 1)
  invalidate()
  try {
    return await action()
  } finally {
    invalidate()
    for (const listener of listeners) listener(project)
  }
}

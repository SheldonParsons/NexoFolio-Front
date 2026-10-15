import { pageVisible, waitForObservation } from '@/features/curation/observation'
import { ApiError } from '@/api/client'
import * as knowledge from '@/contracts/knowledge/source'
import type { CurateProgress } from '@/contracts/knowledge/types'

/** A failed transport does not establish that a server job failed. */
export function temporaryCurationReadFailure(cause: unknown): boolean {
  return (
    cause instanceof ApiError &&
    cause.code !== 'CURATION_NOT_SUBMITTED' &&
    (cause.kind === 'timeout' ||
      cause.kind === 'network' ||
      (cause.kind === 'http' && [408, 429, 502, 503, 504].includes(cause.status ?? 0)))
  )
}

/** Retry reads only; never replay a POST whose acceptance is uncertain. */
export async function reconnectCuration(
  projectId: string,
  signal: AbortSignal,
  pause: () => Promise<void>,
  recovering: () => void,
  runKey = '',
): Promise<CurateProgress> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (!pageVisible()) await waitForObservation(signal)
      return await knowledge.curateProgress(projectId, signal, runKey)
    } catch (cause) {
      if (signal.aborted || !temporaryCurationReadFailure(cause)) throw cause
      recovering()
      if (attempt === 2)
        throw new Error('暂时无法确认后台整理状态，请刷新页面继续查看；请求超时不代表整理失败。')
      await pause()
    }
  }
  throw new Error('暂时无法确认后台整理状态。')
}

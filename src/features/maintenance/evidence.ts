import { ApiError } from '@/api/client'
import type { EvidenceRef } from './models'
export type EvidenceContent =
  | { kind: 'screenshot'; blob: Blob; related?: EvidenceRef[] }
  | { kind: 'text'; text: string; related?: EvidenceRef[] }
export interface EvidenceReader {
  read(projectId: string, ref: EvidenceRef, signal: AbortSignal): Promise<EvidenceContent>
}
export interface EvidenceTransportOptions {
  baseUrl: string
  origin: string
  /** Only the eventual validated contract adapter supplies this path, never model/DOM text. */
  pathFor(projectId: string, evidenceId: string, kind: EvidenceRef['kind']): string
  getAccessToken(): string | undefined
  fetcher?: typeof fetch
  maxBytes: number
  timeoutMs?: number
}
function evidenceUrl(options: EvidenceTransportOptions, projectId: string, ref: EvidenceRef) {
  if (ref.projectId !== projectId) throw new ApiError('证据不属于当前项目。', 'invalid-response')
  const path = options.pathFor(projectId, ref.id, ref.kind)
  let decoded: string
  try {
    decoded = decodeURIComponent(path.split('?')[0] ?? '')
  } catch {
    throw new ApiError('证据路径无效。', 'invalid-response')
  }
  if (
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.startsWith('//') ||
    /[\\#\x00-\x1f]/.test(path) ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    decoded.split('/').some((part) => part === '.' || part === '..')
  )
    throw new ApiError('证据路径必须位于已配置的服务中。', 'invalid-response')
  const base = new URL(options.baseUrl.replace(/\/+$/, '') + '/', options.origin)
  const url = new URL(path.replace(/^\/+/, ''), base)
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
    throw new ApiError('证据路径超出服务范围。', 'invalid-response')
  return url.href
}
export function createEvidenceReader(options: EvidenceTransportOptions): EvidenceReader {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1)
    throw new TypeError('Evidence maxBytes must be a positive safe integer')
  return {
    async read(projectId, ref, signal) {
      const url = evidenceUrl(options, projectId, ref)
      const token = options.getAccessToken()
      if (!token) throw new ApiError('登录已过期，请重新登录。', 'http', 401)
      const controller = new AbortController()
      let timeout = false
      const abort = () => controller.abort(signal.reason)
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
      const timer = setTimeout(() => {
        timeout = true
        controller.abort()
      }, options.timeoutMs ?? 15000)
      try {
        const response = await (options.fetcher ?? fetch)(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept:
              ref.kind === 'screenshot'
                ? 'image/png,image/jpeg,image/webp'
                : 'text/*,application/json',
          },
          cache: 'no-store',
          redirect: 'error',
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok)
          throw new ApiError(
            response.status === 403
              ? '没有查看此项目证据的权限。'
              : response.status === 404
                ? '证据不存在或已不可用。'
                : `证据读取失败（${response.status}）。`,
            'http',
            response.status,
          )
        const mime = (response.headers.get('Content-Type') ?? '')
          .split(';')[0]!
          .trim()
          .toLowerCase()
        const allowed =
          ref.kind === 'screenshot'
            ? ['image/png', 'image/jpeg', 'image/webp'].includes(mime)
            : mime.startsWith('text/') || /^application\/(?:[\w.-]+\+)?json$/.test(mime)
        if (!allowed)
          throw new ApiError('证据类型与请求不匹配，不进行嵌入展示。', 'invalid-response')
        const length = Number(response.headers.get('Content-Length'))
        if (Number.isFinite(length) && length > options.maxBytes)
          throw new ApiError('证据超过预览大小限制，未截断伪装为完整内容。', 'invalid-response')
        const reader = response.body?.getReader()
        if (!reader) throw new ApiError('证据内容为空。', 'invalid-response')
        const chunks: BlobPart[] = []
        let size = 0
        try {
          while (true) {
            const part = await reader.read()
            if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
            if (part.done) break
            size += part.value.byteLength
            if (size > options.maxBytes)
              throw new ApiError('证据超过预览大小限制，未截断伪装为完整内容。', 'invalid-response')
            chunks.push(new Uint8Array(part.value).buffer)
          }
        } finally {
          await reader.cancel().catch(() => {})
          reader.releaseLock()
        }
        const blob = new Blob(chunks, { type: mime })
        return ref.kind === 'screenshot'
          ? { kind: 'screenshot', blob }
          : { kind: 'text', text: await blob.text() }
      } catch (cause) {
        if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
        if (timeout) throw new ApiError('证据读取超时，请重试。', 'timeout')
        if (cause instanceof ApiError) throw cause
        throw new ApiError('暂时无法读取证据，请检查连接。', 'network')
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
      }
    },
  }
}

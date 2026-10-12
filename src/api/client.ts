import { clientProblem } from '@/features/audit/telemetry'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ApiClientOptions {
  baseUrl: string
  timeoutMs?: number
  fetcher?: typeof fetch
  onUnauthorized?: () => void
  getAccessToken?: () => string | undefined
  /** Optional observer; release after the body is read, including error/abort paths. */
  onRequestStart?: (path: string) => (() => void) | undefined
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown
  /** Overrides the client default. Curation waits on a model, so it needs longer. */
  timeoutMs?: number
}

/** Paths stay under the configured base; callers cannot accidentally send credentials elsewhere. */
function joinPath(base: string, path: string): string {
  const decoded = decodeURIComponent(path.split('?')[0] ?? '')
  if (
    /^[a-z][a-z\d+.-]*:/i.test(path) ||
    path.startsWith('//') ||
    /[\\#]/.test(path) ||
    decoded.split('/').some((part) => part === '..' || part === '.') ||
    decoded.startsWith('//') ||
    decoded.includes('\\')
  ) {
    throw new TypeError('API path must stay within the configured base URL')
  }
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export function createApiClient({
  baseUrl,
  timeoutMs = 15_000,
  fetcher = fetch,
  onUnauthorized,
  getAccessToken,
  onRequestStart,
}: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = joinPath(baseUrl, path)
    const { json, signal, timeoutMs: requestTimeoutMs, ...init } = options
    const headers = new Headers(init.headers)
    const token = getAccessToken?.()
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    headers.set('Accept', 'application/json')
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    const controller = new AbortController()
    let timedOut = false
    const cancel = () => controller.abort(signal?.reason)
    if (signal?.aborted) cancel()
    else signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, requestTimeoutMs ?? timeoutMs)
    let requestId: string | undefined
    let releaseRequest: (() => void) | undefined
    try {
      releaseRequest = onRequestStart?.(path)
      const response = await fetcher(url, {
        credentials: 'same-origin',
        ...init,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: controller.signal,
      })
      requestId = response.headers.get('x-request-id') ?? undefined
      if (response.status === 401 && (!getAccessToken || getAccessToken() === token))
        onUnauthorized?.()
      if (!response.ok) {
        let message =
          response.status === 401
            ? '登录已过期，请重新登录。'
            : response.status === 408
              ? '处理超时，请稍后重试。'
              : `请求失败（${response.status}）`
        if (response.status !== 401 && /json/i.test(response.headers.get('content-type') ?? '')) {
          try {
            const body: unknown = await response.json()
            if (
              body &&
              typeof body === 'object' &&
              'error' in body &&
              body.error &&
              typeof body.error === 'object' &&
              'message' in body.error &&
              typeof body.error.message === 'string' &&
              body.error.message.trim()
            )
              message = body.error.message.trim()
          } catch (error) {
            if (controller.signal.aborted) throw error
          }
        }
        throw new ApiError(message, 'http', response.status, requestId)
      }
      if (response.status === 204) return undefined as T
      if (
        !/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(
          response.headers.get('content-type') ?? '',
        )
      ) {
        throw new ApiError(
          '服务返回了非 JSON 内容，请检查 API 连接。',
          'invalid-response',
          response.status,
        )
      }
      try {
        return (await response.json()) as T
      } catch (error) {
        if (controller.signal.aborted) throw error
        throw new ApiError('服务返回的数据格式不正确。', 'invalid-response', response.status)
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
      if (timedOut) {
        clientProblem('CLIENT_TIMEOUT', requestId)
        throw new ApiError('请求超时，请稍后重试。', 'timeout', undefined, requestId)
      }
      if (error instanceof ApiError) {
        if (error.kind === 'invalid-response') clientProblem('INVALID_RESPONSE', requestId)
        throw error
      }
      clientProblem('NETWORK_ERROR', requestId)
      throw new ApiError('暂时无法连接服务，请检查网络。', 'network')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      releaseRequest?.()
    }
  }
  return { request }
}

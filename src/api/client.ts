export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number,
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
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown
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
}: ApiClientOptions) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = joinPath(baseUrl, path)
    const { json, signal, ...init } = options
    const headers = new Headers(init.headers)
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
    }, timeoutMs)
    try {
      const response = await fetcher(url, {
        credentials: 'same-origin',
        ...init,
        headers,
        body: json === undefined ? undefined : JSON.stringify(json),
        signal: controller.signal,
      })
      if (response.status === 401) onUnauthorized?.()
      if (!response.ok)
        throw new ApiError(
          response.status === 401 ? '登录已过期，请重新登录。' : `请求失败（${response.status}）`,
          'http',
          response.status,
        )
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
      if (timedOut) throw new ApiError('请求超时，请稍后重试。', 'timeout')
      if (error instanceof ApiError) throw error
      throw new ApiError('暂时无法连接服务，请检查网络。', 'network')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
    }
  }
  return { request }
}

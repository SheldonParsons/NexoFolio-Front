import type { App } from 'vue'
import type { Router, RouteLocationNormalizedLoaded } from 'vue-router'
import { readCredential } from '@/api/session'

const docs = new Set(['philosophy', 'fetcher', 'mcp', 'api', 'retirement'])
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function pageContext(route: Pick<RouteLocationNormalizedLoaded, 'name' | 'params'>) {
  let name = String(route.name ?? 'not-found')
  if (name === 'audit' || name.startsWith('management-')) return null
  if (name === 'product-docs') {
    const slug = String(route.params.docSlug || 'philosophy')
    name += `:${docs.has(slug) ? slug : 'unknown'}`
  }
  const id = (value: unknown) => (typeof value === 'string' && uuid.test(value) ? value : undefined)
  return {
    route: name,
    project: id(route.params.projectId),
    resource: id(route.params.endpointId ?? route.params.folderId ?? route.params.candidateId),
  }
}
export type ClientProblem =
  | 'JS_ERROR'
  | 'UNHANDLED_REJECTION'
  | 'VUE_ERROR'
  | 'ROUTE_ERROR'
  | 'NETWORK_ERROR'
  | 'CLIENT_TIMEOUT'
  | 'INVALID_RESPONSE'
let reportProblem: ((code: ClientProblem, requestId?: string) => void) | undefined
export function clientProblem(code: ClientProblem, requestId?: string) {
  reportProblem?.(code, requestId)
}

/** Fixed small payloads, capped events, no retries and no errors propagated into the app. */
export function installTelemetry(app: App, router: Router) {
  let windowStart = Date.now()
  let sent = 0
  let errors = 0
  let inFlight = 0
  const send = (kind: 'page' | 'error', code?: ClientProblem, requestId?: string) => {
    const context = pageContext(router.currentRoute.value)
    if (!context) return
    if (Date.now() - windowStart >= 60_000) {
      windowStart = Date.now()
      sent = 0
      errors = 0
    }
    if (sent >= 60 || inFlight >= 4 || (kind === 'error' && errors >= 10)) return
    sent++
    if (kind === 'error') errors++
    // Run after the current navigation/render work; never await it from a route or API.
    inFlight++
    setTimeout(() => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const token = readCredential()?.token
      void fetch(
        `${(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')}/v1/telemetry`,
        {
          method: 'POST',
          credentials: 'same-origin',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            kind,
            ...context,
            code,
            request_id: requestId && uuid.test(requestId) ? requestId : undefined,
          }),
          signal: controller.signal,
        },
      )
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer)
          inFlight--
        })
    }, 0)
  }
  reportProblem = (code, requestId) => send('error', code, requestId)
  router.afterEach((to, from, failure) => {
    if (!failure && (!from.matched.length || to.path !== from.path)) send('page')
  })
  router.onError(() => send('error', 'ROUTE_ERROR'))
  window.addEventListener('error', () => send('error', 'JS_ERROR'))
  window.addEventListener('unhandledrejection', () => send('error', 'UNHANDLED_REJECTION'))
  const previous = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    send('error', 'VUE_ERROR')
    if (previous) previous(error, instance, info)
    else console.error(error)
  }
}

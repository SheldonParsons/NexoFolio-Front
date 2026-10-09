import { mcpServiceUrl } from '../mcp-credentials/connection'

export interface McpDocumentationLinks {
  serviceUrl: string
  documentUrl: string
  referenceUrl: string
  credentialsUrl: string
}

/** Use the same API base as the credential page; page links follow the current app. */
export function mcpDocumentationLinks(
  apiBase: string,
  pageUrl: string,
  appBase = '/',
): McpDocumentationLinks {
  const origin = new URL(pageUrl).origin
  const root = new URL(appBase.replace(/\/?$/, '/'), origin)
  return {
    serviceUrl: mcpServiceUrl(apiBase, origin),
    documentUrl: new URL('docs/mcp', root).href,
    referenceUrl: new URL('mcp.md', root).href,
    credentialsUrl: new URL('settings/mcp', root).href,
  }
}

/** Static hosting has no request origin; same-origin links remain concrete route paths. */
export function mcpRelativeDocumentationLinks(
  apiBase = '/api',
  appBase = '/',
): McpDocumentationLinks {
  const origin = 'https://nexofolio.invalid'
  const links = mcpDocumentationLinks(apiBase, origin, appBase)
  const relative = (value: string) =>
    value.startsWith(origin) ? value.slice(origin.length) : value
  return {
    serviceUrl: relative(links.serviceUrl),
    documentUrl: relative(links.documentUrl),
    referenceUrl: relative(links.referenceUrl),
    credentialsUrl: relative(links.credentialsUrl),
  }
}

/** MCP shares the configured API proxy prefix; never derive it from a documentation URL. */
export function mcpServiceUrl(apiBase: string, pageUrl: string): string {
  try {
    const base = new URL(apiBase, pageUrl)
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return ''
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/mcp`
    return base.href
  } catch {
    return ''
  }
}

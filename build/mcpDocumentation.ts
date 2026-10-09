import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import type { Plugin, ResolvedConfig } from 'vite'
import { apiReference } from './apiReference'
import { mcpSearchText } from '../src/features/mcp-docs/content'
import { mcpInstallPrompt, mcpOnboardingText } from '../src/features/mcp-docs/onboarding'
import {
  mcpDocumentationLinks,
  mcpRelativeDocumentationLinks,
} from '../src/features/mcp-docs/environment'

const MarkdownIt = createRequire(import.meta.url)('markdown-it') as new (options: {
  html: boolean
}) => { render: (body: string) => string }
const markdown = new MarkdownIt({ html: false })
export function mcpReference(
  root: string,
  environment: { apiBase?: string; appBase?: string; pageUrl?: string } = {},
): string {
  const apiBase = environment.apiBase || '/api',
    appBase = environment.appBase || '/'
  const links = environment.pageUrl
    ? mcpDocumentationLinks(apiBase, environment.pageUrl, appBase)
    : mcpRelativeDocumentationLinks(apiBase, appBase)
  if (!links.serviceUrl) throw new Error('Invalid API base for MCP documentation')
  const connection = `## 当前实例连接信息\n\n- MCP 服务地址：[${links.serviceUrl}](${links.serviceUrl})\n- 凭证管理：[${links.credentialsUrl}](${links.credentialsUrl})\n- 安装文档：[${links.documentUrl}](${links.documentUrl})\n- 完整参考：[${links.referenceUrl}](${links.referenceUrl})\n\n相对地址使用本文所在域名解析，填写客户端时使用解析后的完整 URL；无需自行替换示例域名。\n\n${mcpInstallPrompt(links.documentUrl, links)}\n`
  const body = readFileSync(resolve(root, 'src/content/docs/mcp.md'), 'utf8')
  return [
    body.replace(/^(#[^\n]+)\n/, `$1\n\n${connection}\n`),
    mcpOnboardingText,
    mcpSearchText,
  ].join('\n\n')
}
export function documentReferenceHtml(
  template: string,
  reference: string,
  base = '/',
  kind: 'mcp' | 'api' = 'mcp',
): string {
  const href = `${base.replace(/\/?$/, '/')}${kind}.md`
  const text = reference.replace(
    /\]\(\/(docs\/[a-z0-9-]+|(?:mcp|api)\.md|settings\/mcp|contracts\/[^)]+)\)/g,
    `](${base.replace(/\/?$/, '/')}$1)`,
  )
  const body = `<main data-${kind}-reference style="max-width:960px;margin:auto;padding:40px 24px;font-family:system-ui,sans-serif;line-height:1.8;overflow-wrap:anywhere">${markdown.render(text)}</main>`
  if (!template.includes('<div id="app"></div>'))
    throw new Error('Documentation requires the app mount point')
  return template
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`)
    .replace(
      '</head>',
      `<link rel="alternate" type="text/markdown" href="${href}" title="NexoFolio ${kind.toUpperCase()} reference" /></head>`,
    )
}
export function mcpReferenceHtml(template: string, reference: string, base = '/'): string {
  return documentReferenceHtml(template, reference, base, 'mcp')
}
export function mcpDocumentation(): Plugin {
  let config: ResolvedConfig
  const basePath = () => config.base.replace(/\/?$/, '/')
  const environment = (pageUrl?: string) => ({
    apiBase: String(config.env.VITE_API_BASE_URL || '/api'),
    appBase: config.base,
    pageUrl,
  })
  const documentKind = (path: string) =>
    (['mcp', 'api'] as const).find((kind) =>
      [
        basePath() + `docs/${kind}`,
        basePath() + `docs/${kind}/`,
        basePath() + `${kind}.md`,
      ].includes(path),
    )
  return {
    name: 'nexofolio-agent-documentation',
    configResolved(value) {
      config = value
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://local').pathname
        const kind = documentKind(path)
        if (!['GET', 'HEAD'].includes(req.method ?? '') || !kind) return next()
        try {
          const pageUrl = new URL(
            req.url ?? path,
            `${config.server.https ? 'https' : 'http'}://${req.headers.host || 'localhost'}`,
          ).href
          const reference =
            kind === 'api'
              ? apiReference(config.root, environment(pageUrl))
              : mcpReference(config.root, environment(pageUrl))
          const isMarkdown = path.endsWith('.md')
          const value = isMarkdown
            ? reference
            : await server.transformIndexHtml(
                req.url ?? path,
                documentReferenceHtml(
                  readFileSync(resolve(config.root, 'index.html'), 'utf8'),
                  reference,
                  config.base,
                  kind,
                ),
              )
          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            isMarkdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8',
          )
          res.setHeader('Cache-Control', 'no-cache')
          res.end(req.method === 'HEAD' ? '' : value)
        } catch (cause) {
          next(cause)
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://local').pathname
        const kind = documentKind(path)
        if (!['GET', 'HEAD'].includes(req.method ?? '') || !kind) return next()
        try {
          const isMarkdown = path.endsWith('.md')
          const html = readFileSync(
            resolve(config.root, config.build.outDir, `${kind}.${isMarkdown ? 'md' : 'html'}`),
            'utf8',
          )
          res.setHeader(
            'Content-Type',
            isMarkdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8',
          )
          res.setHeader('Cache-Control', 'no-cache')
          res.end(req.method === 'HEAD' ? '' : html)
        } catch (cause) {
          next(cause)
        }
      })
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const entry = bundle['index.html']
        if (entry?.type !== 'asset' || typeof entry.source !== 'string')
          throw new Error('Missing index.html for MCP documentation')
        for (const kind of ['mcp', 'api'] as const) {
          const reference =
            kind === 'api'
              ? apiReference(config.root, environment())
              : mcpReference(config.root, environment())
          this.emitFile({
            type: 'asset',
            fileName: `${kind}.html`,
            source: documentReferenceHtml(entry.source, reference, config.base, kind),
          })
          this.emitFile({ type: 'asset', fileName: `${kind}.md`, source: reference })
        }
      },
    },
  }
}

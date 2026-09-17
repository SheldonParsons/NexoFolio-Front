import philosophy from '@/content/docs/philosophy.md?raw'
import fetcher from '@/content/docs/fetcher.md?raw'
import workflow from '@/content/docs/workflow.md?raw'
import api from '@/content/docs/api.md?raw'
import mcp from '@/content/docs/mcp.md?raw'
import docsPreview from '@/content/changelog/product-docs-preview.md?raw'

export interface ProductArticle {
  slug: string
  path: string
  title: string
  section: '使用文档' | '开放 API' | 'MCP'
  description: string
  body: string
}
export const productArticles: ProductArticle[] = [
  {
    slug: 'philosophy',
    path: '/docs',
    title: 'NexoFolio 哲学',
    section: '使用文档',
    description: '让分散的接口信息，成为可以理解、连接与演进的知识。',
    body: philosophy,
  },
  {
    slug: 'fetcher',
    path: '/docs/fetcher',
    title: 'NexoFolio Fetcher',
    section: '使用文档',
    description: '从浏览器开始，也为其他接入方式留出空间。',
    body: fetcher,
  },
  {
    slug: 'workflow',
    path: '/docs/workflow',
    title: '阅读、整理与演进',
    section: '使用文档',
    description: '了解接口阅读、重构审阅和发布回退之间的关系。',
    body: workflow,
  },
  {
    slug: 'api',
    path: '/docs/api',
    title: '开放 API',
    section: '开放 API',
    description: '让自己的工具与工作流，成为接口知识的入口。',
    body: api,
  },
  {
    slug: 'mcp',
    path: '/docs/mcp',
    title: 'MCP 与 NexoFolio',
    section: 'MCP',
    description: '让 Agent 读取有上下文、有依据的项目接口知识。',
    body: mcp,
  },
]

export interface ProductUpdate {
  slug: string
  product: 'nexofolio' | 'fetcher'
  date: string
  version: string
  title: string
  description: string
  preview?: boolean
  body: string
}
// A local documentation preview, not a fabricated product release history.
export const productUpdates: ProductUpdate[] = [
  {
    slug: 'product-docs-preview',
    product: 'nexofolio',
    date: '2026-09-16',
    version: '文档预览',
    title: '从理念开始，认识 NexoFolio',
    description: '产品文档第一版，先把接入方式、知识演进和 Agent 使用方向讲清楚。',
    preview: true,
    body: docsPreview,
  },
]
export const productLabels = { nexofolio: 'NexoFolio', fetcher: 'Fetcher' }

import philosophy from '@/content/docs/philosophy.md?raw'
import fetcher from '@/content/docs/fetcher.md?raw'
import { fetcherGuideSearchText } from './fetcherGuide'
import api from '@/content/docs/api.md?raw'
import mcp from '@/content/docs/mcp.md?raw'
import { mcpSearchText } from '@/features/mcp-docs/content'
import docsPreview from '@/content/changelog/product-docs-preview.md?raw'
import agentDocsUpdate from '@/content/changelog/2026-10-09-mcp-agent-docs.md?raw'
import fetcher013Update from '@/content/changelog/2026-10-09-fetcher-0-1-3.md?raw'
import curationUpdate from '@/content/changelog/2026-10-09-curation-experience.md?raw'

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
    title: '认识 NexoFolio',
    section: '使用文档',
    description: '让分散的接口信息，成为可以理解、连接与演进的知识。',
    body: philosophy,
  },
  {
    slug: 'fetcher',
    path: '/docs/fetcher',
    title: 'NexoFolio Fetcher',
    section: '使用文档',
    description: '从安装到第一条记录，跟着四步把真实调用带回 NexoFolio。',
    body: fetcher + '\n\n' + fetcherGuideSearchText,
  },
  {
    slug: 'api',
    path: '/docs/api',
    title: '录入接口',
    section: '开放 API',
    description: '把抓包、日志和接口结构资料保存到项目里，按回执确认哪些已接收。',
    body: api,
  },
  {
    slug: 'mcp',
    path: '/docs/mcp',
    title: 'MCP 与 NexoFolio',
    section: 'MCP',
    description: '让 Agent 读取有上下文、有依据的项目接口知识。',
    body: mcp + mcpSearchText,
  },
]

export interface ProductUpdate {
  slug: string
  product: 'nexofolio' | 'fetcher'
  date: string
  version: string
  title: string
  description: string
  status: 'released' | 'update' | 'preview'
  documentation?: string
  body: string
}
// Feature updates, versioned releases, and preview records share one timeline.
export const productUpdates: ProductUpdate[] = [
  {
    slug: '2026-10-09-mcp-agent-docs',
    product: 'nexofolio',
    date: '2026-10-09',
    version: '功能更新',
    status: 'update',
    title: 'MCP 接入与 Agent 开发文档更新',
    description: '账号级凭证、项目与环境发现，以及能直接交给 Agent 阅读和开发的文档入口。',
    documentation: '/docs/mcp',
    body: agentDocsUpdate,
  },
  {
    slug: 'fetcher-0-1-3',
    product: 'fetcher',
    date: '2026-10-09',
    version: 'v0.1.3 开发版',
    status: 'released',
    title: '默认连接公网灰度，新安装即可登录',
    description: '预填公网服务，保留用户已有配置，修正插件内的版本显示。',
    documentation: '/docs/fetcher',
    body: fetcher013Update,
  },
  {
    slug: '2026-10-09-curation-experience',
    product: 'nexofolio',
    date: '2026-10-09',
    version: '近期迭代',
    status: 'update',
    title: '整理进度与审阅体验改进',
    description: '当前页查看进度、三个面板尺寸、轮次切换、操作记录和更清楚的文档导航。',
    documentation: '/docs',
    body: curationUpdate,
  },
  {
    slug: 'product-docs-preview',
    product: 'nexofolio',
    date: '2026-09-16',
    version: '文档预览',
    title: '从理念开始，认识 NexoFolio',
    description: '产品文档第一版，先把接入方式、知识演进和 Agent 使用方向讲清楚。',
    status: 'preview',
    body: docsPreview,
  },
]
export const productLabels = { nexofolio: 'NexoFolio', fetcher: 'Fetcher' }
export const updateStatusLabels = { released: '已发布', update: '本轮更新', preview: '预览记录' }

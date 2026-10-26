import retirement from '@/content/docs/retirement.md?raw'
import retirementUpdate from '@/content/changelog/2026-10-11-document-retirement.md?raw'
import philosophy from '@/content/docs/philosophy.md?raw'
import fetcher from '@/content/docs/fetcher.md?raw'
import { fetcherGuideSearchText } from './fetcherGuide'
import api from '@/content/docs/api.md?raw'
import mcp from '@/content/docs/mcp.md?raw'
import { mcpSearchText } from '@/features/mcp-docs/content'
import docsPreview from '@/content/changelog/product-docs-preview.md?raw'
import agentDocsUpdate from '@/content/changelog/2026-10-09-mcp-agent-docs.md?raw'
import mcpRetrievalUpdate from '@/content/changelog/2026-10-10-mcp-progressive-retrieval.md?raw'
import publicDocumentUpdate from '@/content/changelog/2026-10-10-public-document-reading.md?raw'
import fetcher013Update from '@/content/changelog/2026-10-09-fetcher-0-1-3.md?raw'
import fetcher021Update from '@/content/changelog/2026-10-12-fetcher-0-2-1.md?raw'
import reliabilityUpdate from '@/content/changelog/2026-10-15-curation-reliability-and-performance.md?raw'
import fetcher022Update from '@/content/changelog/2026-10-15-fetcher-0-2-2.md?raw'
import curationUpdate from '@/content/changelog/2026-10-09-curation-experience.md?raw'
import mcpCompactUpdate from '@/content/changelog/2026-10-19-mcp-compact-evidence.md?raw'
import projectsAndMcpUpdate from '@/content/changelog/2026-10-20-projects-and-mcp-reading.md?raw'
import fetcher024Update from '@/content/changelog/2026-10-20-fetcher-0-2-4.md?raw'
import workspaceNavigationUpdate from '@/content/changelog/2026-10-20-workspace-navigation.md?raw'
import projectWorkspaceLayoutUpdate from '@/content/changelog/2026-10-26-project-workspace-layout.md?raw'
import fetcher025Update from '@/content/changelog/2026-10-26-fetcher-0-2-5.md?raw'
import curationSaveAndReviewUpdate from '@/content/changelog/2026-10-26-curation-save-and-review.md?raw'

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
    slug: 'retirement',
    path: '/docs/retirement',
    title: '废弃与撤销废弃',
    section: '使用文档',
    description: '管理目录、接口和字段的生命周期，保留历史并在下一轮整理核对。',
    body: retirement,
  },
  {
    slug: 'mcp',
    path: '/docs/mcp',
    title: 'MCP 与 NexoFolio',
    section: 'MCP',
    description: '让 Agent 自选目录、搜索或字段线索，按需读取完整说明、原始依据和资料缺口。',
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
    slug: '2026-10-26-curation-save-and-review',
    product: 'nexofolio',
    date: '2026-10-26',
    version: '优化与修复',
    status: 'update',
    title: '整理成果保存更高效，结果读取与内网应用恢复正常',
    description:
      '合并保存已生成的字段成果，修复较大整理结果读取超时和内网 HTTP 确认应用报错，保留恢复能力与原有整理质量标准。',
    body: curationSaveAndReviewUpdate,
  },
  {
    slug: '2026-10-26-project-workspace-layout',
    product: 'nexofolio',
    date: '2026-10-26',
    version: '界面更新',
    status: 'update',
    title: '项目空间布局更紧凑',
    description: '标题、搜索与项目列表集中展示，减少独立介绍栏和装饰性文字，调整桌面与窄屏布局。',
    body: projectWorkspaceLayoutUpdate,
  },
  {
    slug: 'fetcher-0-2-5',
    product: 'fetcher',
    date: '2026-10-26',
    version: 'v0.2.5 开发版 · 强制更新',
    status: 'update',
    title: 'Fetcher 首次安装与登录恢复，下载文件名统一',
    description:
      '修复部分 Chrome 环境首次安装卡在版本检查页的问题，完善重试、重新加载和服务读取提示；内外网强制更新至 0.2.5，下载文件名保持一致。',
    documentation: '/docs/fetcher',
    body: fetcher025Update,
  },
  {
    slug: '2026-10-20-workspace-navigation',
    product: 'nexofolio',
    date: '2026-10-20',
    version: '功能更新',
    status: 'update',
    title: '项目切换更顺手，悬停反馈更清楚',
    description:
      '顶部增加最近项目入口，接口文档菜单更紧凑；修复切换后最近访问消失，统一菜单与列表的图标、动画和文字对比度。',
    body: workspaceNavigationUpdate,
  },
  {
    slug: '2026-10-20-projects-and-mcp-reading',
    product: 'nexofolio',
    date: '2026-10-20',
    version: '功能更新',
    status: 'update',
    title: '项目更好找，MCP 读取更集中',
    description:
      '项目搜索、最近整理与整理人一眼可见；MCP 支持解析正文与字段分组，补充两道真实 Agent 对照，完善下载渠道和页面恢复提示。',
    documentation: '/docs/mcp',
    body: projectsAndMcpUpdate,
  },
  {
    slug: 'fetcher-0-2-4',
    product: 'fetcher',
    date: '2026-10-20',
    version: 'v0.2.4 开发版 · 强制更新',
    status: 'update',
    title: 'Fetcher 内外网双包、Header 采集与更新校验修复',
    description:
      '内外网分别下载安装，修复部分 Header 缺失及升级后误报策略冲突，重新检查有明确反馈；本版为强制更新。',
    documentation: '/docs/fetcher',
    body: fetcher024Update,
  },
  {
    slug: '2026-10-19-mcp-compact-evidence',
    product: 'nexofolio',
    date: '2026-10-19',
    version: '功能更新',
    status: 'update',
    title: 'MCP 说明更精简，关联依据更清楚',
    description:
      '减少重复说明，完善参数来源判断与证据边界；公开四组真实 Agent 对照及关系消重复测，检索路线仍由 Agent 自主决定。',
    documentation: '/docs/mcp',
    body: mcpCompactUpdate,
  },
  {
    slug: '2026-10-15-curation-reliability-and-performance',
    product: 'nexofolio',
    date: '2026-10-15',
    version: '功能更新',
    status: 'update',
    title: '整理更稳定，排队和恢复更省心',
    description:
      '忙时自动排队，临时故障后自动重试，已保存成果继续保留；文档打开和应用更快，等待过程更清楚。',
    body: reliabilityUpdate,
  },
  {
    slug: 'fetcher-0-2-2',
    product: 'fetcher',
    date: '2026-10-15',
    version: 'v0.2.2 开发版 · 强制更新',
    status: 'update',
    title: 'Fetcher 上传与重试更稳定',
    description:
      '服务忙时自动等待，网络波动后自动重试，保留本地未确认上传的内容，减少账号和服务切换的干扰。',
    documentation: '/docs/fetcher',
    body: fetcher022Update,
  },
  {
    slug: 'fetcher-0-2-1',
    product: 'fetcher',
    date: '2026-10-12',
    version: 'v0.2.1 开发版',
    status: 'update',
    title: 'Fetcher 接口详情、手动调试与强制更新',
    description: '点击记录查看详情，编辑请求后手动发送；完善绑定指引、头像和 OSS 版本更新。',
    documentation: '/docs/fetcher',
    body: fetcher021Update,
  },
  {
    slug: '2026-10-11-document-retirement',
    product: 'nexofolio',
    date: '2026-10-11',
    version: '功能更新',
    status: 'update',
    title: '目录、接口和字段可废弃与恢复',
    description: '支持废弃与撤销，保留历史；修复整理与历史读取问题，优化文档浏览，减少重复查询。',
    documentation: '/docs/retirement',
    body: retirementUpdate,
  },
  {
    slug: '2026-10-10-public-document-reading',
    product: 'nexofolio',
    date: '2026-10-10',
    version: '功能更新',
    status: 'update',
    title: '分享接口文档，无需先登录',
    description:
      '打开原链接即可只读查看目录、接口和字段说明；修改操作、真实样本及 MCP 继续保留权限限制。',
    body: publicDocumentUpdate,
  },
  {
    slug: '2026-10-10-mcp-progressive-retrieval',
    product: 'nexofolio',
    date: '2026-10-10',
    version: '功能更新',
    status: 'update',
    title: 'MCP 渐进式检索与使用文档更新',
    description: '你提出业务问题，Agent 自己选路查资料；完整说明、原始依据和资料缺口都可按需查看。',
    documentation: '/docs/mcp',
    body: mcpRetrievalUpdate,
  },
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

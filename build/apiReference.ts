import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  collectAgentLinks,
  collectAgentPrompt,
  collectRelativeAgentLinks,
} from '../src/features/collect-docs/agent'

export function apiReference(
  root: string,
  environment: { apiBase?: string; appBase?: string; pageUrl?: string } = {},
): string {
  const apiBase = environment.apiBase || '/api',
    appBase = environment.appBase || '/'
  const links = environment.pageUrl
    ? collectAgentLinks(apiBase, environment.pageUrl, appBase)
    : collectRelativeAgentLinks(apiBase, appBase)
  if (!links.endpoint) throw new Error('Invalid API base for collection documentation')
  const connection = `# NexoFolio 录入 API 开发说明\n\n## 当前实例与阅读入口\n\n- 录入地址：POST [${links.endpoint}](${links.endpoint})\n- 文档：[${links.documentUrl}](${links.documentUrl})\n- 完整文本：[${links.referenceUrl}](${links.referenceUrl})\n- 格式规范与示例包：[${links.contractUrl}](${links.contractUrl})\n\n相对链接按本文所在域名解析成完整 URL。本说明无需执行 JavaScript，包含完整字段、示例、回执与重试规则；网页内的演练不会实际录入。\n\n## 可复制的开发开场\n\n${collectAgentPrompt(links)}\n\n`
  return connection + readFileSync(resolve(root, 'src/content/docs/api.md'), 'utf8')
}

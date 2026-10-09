import manifest from '../../contracts/collect/1.1.0/manifest.json'
import { collectServiceBase } from './guide'

export interface CollectAgentLinks {
  documentUrl: string
  referenceUrl: string
  endpoint: string
  contractUrl: string
}
export function collectAgentLinks(
  apiBase: string,
  pageUrl: string,
  appBase = '/',
): CollectAgentLinks {
  const root = new URL(appBase.replace(/\/?$/, '/'), new URL(pageUrl).origin)
  const service = collectServiceBase(apiBase, pageUrl)
  return {
    documentUrl: new URL('docs/api', root).href,
    referenceUrl: new URL('api.md', root).href,
    endpoint: service ? `${service}/v1/collect/batches` : '',
    contractUrl: new URL(`contracts/collect-${manifest.contract_version}.zip`, root).href,
  }
}
export function collectRelativeAgentLinks(apiBase = '/api', appBase = '/'): CollectAgentLinks {
  const origin = 'https://nexofolio.invalid'
  const links = collectAgentLinks(apiBase, origin, appBase)
  const relative = (value: string) =>
    value.startsWith(origin) ? value.slice(origin.length) : value
  return {
    documentUrl: relative(links.documentUrl),
    referenceUrl: relative(links.referenceUrl),
    endpoint: relative(links.endpoint),
    contractUrl: relative(links.contractUrl),
  }
}
export function collectAgentPrompt(
  links: CollectAgentLinks,
  context: { projectId?: string; environmentId?: string; name?: string } = {},
): string {
  const scope = context.projectId
    ? `\n平台已选项目${context.name ? `「${context.name}」` : ''}，自动附带的定位信息：${JSON.stringify({ project_id: context.projectId, ...(context.environmentId ? { environment_id: context.environmentId } : {}) })}。`
    : ''
  return `请阅读这份 NexoFolio 录入 API 文档，帮我开发接入程序：${links.documentUrl}\n无需执行前端脚本的完整说明：${links.referenceUrl}\n当前录入地址：POST ${links.endpoint}\n规范与示例包：${links.contractUrl}${scope}\n请先确认我的数据来源、开发语言、目标项目和环境，再按 collect ${manifest.contract_version} 实现批次组装、格式校验、幂等重试与回执处理。项目和环境按名称从平台或 MCP 查询，不编造 ID。已有代码请先阅读再修改。给出实现、使用说明和验证计划；先使用虚构数据，未经我明确要求，不发送真实录入请求，也不启动整理或应用文档。缺少的信息请集中告诉我。`
}

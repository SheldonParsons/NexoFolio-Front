import { ApiError } from '@/api/client'
import type { Project, ProjectSource } from './types'

// Fictional projects with the same wire shape as GET /v1/projects.
const rows: [string, string, Project['access_state']][] = [
  ['智能供销平台', 'doing', 'allowed'],
  ['客户关系管理', 'doing', 'allowed'],
  ['订单与履约中心', 'doing', 'allowed'],
  ['产品数据平台', 'doing', 'denied'],
  ['统一身份与权限', 'doing', 'allowed'],
  ['供应链协同', 'wait', 'unknown'],
  ['售后服务平台', 'doing', 'allowed'],
  ['财务结算中心', 'suspended', 'denied'],
  ['渠道运营平台', 'doing', 'allowed'],
  ['设备资产管理', 'doing', 'allowed'],
  ['研发协作空间', 'wait', 'allowed'],
  ['数据分析服务', 'doing', 'unknown'],
  ['仓储管理系统', 'closed', 'allowed'],
  ['移动工作台', 'doing', 'allowed'],
  ['历史接口迁移', 'closed', 'denied'],
  ['开放服务平台', 'doing', 'allowed'],
  ['跨组织业务协同与统一接口知识管理平台', 'doing', 'allowed'],
  ['应用集成实验项目', 'reviewing', 'allowed'],
]
const projects: Project[] = rows.map(([name, status, access], index) => ({
  project_id: `ea821405-0753-4000-8000-${String(index + 1).padStart(12, '0')}`,
  name,
  status,
  can_access: access === 'allowed',
  access_state: access,
  reason_code:
    access === 'allowed'
      ? null
      : access === 'denied'
        ? 'PROJECT_ACCESS_DENIED'
        : 'PROJECT_ACCESS_UNAVAILABLE',
}))
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 260)
    signal.addEventListener('abort', abort, { once: true })
  })
}
export const mockProjects: ProjectSource = {
  async list({ page, limit, q, access_state }, signal) {
    await delay(signal)
    const matched = projects.filter(
      (project) =>
        (!q || project.name.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase())) &&
        (!access_state || project.access_state === access_state),
    )
    return {
      items: matched.slice((page - 1) * limit, page * limit).map((p) => ({ ...p })),
      page,
      limit,
      total: matched.length,
    }
  },
  async get(id, signal) {
    await delay(signal)
    const project = projects.find((p) => p.project_id === id)
    if (!project) throw new ApiError('项目不存在。', 'http', 404)
    if (!project.can_access)
      throw new ApiError(
        project.access_state === 'denied'
          ? '暂无该项目的访问权限，请联系禅道管理员。'
          : '暂时无法确认项目权限，请稍后重试。',
        'http',
        project.access_state === 'denied' ? 403 : 503,
      )
    return { ...project }
  },
}

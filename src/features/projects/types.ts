export type ProjectAccess = 'allowed' | 'denied' | 'unknown'
export interface Project {
  project_id: string
  name: string
  status: string
  can_access: boolean
  access_state: ProjectAccess
  reason_code: string | null
}
export interface ProjectPage {
  items: Project[]
  page: number
  limit: number
  total: number
}
export interface ProjectListQuery {
  page: number
  limit: number
  q?: string
  access_state?: ProjectAccess
}
export interface ProjectSource {
  list(query: ProjectListQuery, signal: AbortSignal): Promise<ProjectPage>
  get(id: string, signal: AbortSignal): Promise<Project>
}
export const statusLabels: Record<string, string> = {
  doing: '进行中',
  wait: '未开始',
  suspended: '已暂停',
  closed: '已关闭',
}
export const accessLabels: Record<ProjectAccess, string> = {
  allowed: '可访问',
  denied: '无访问权限',
  unknown: '待确认权限',
}

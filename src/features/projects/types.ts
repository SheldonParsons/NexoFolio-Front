export type ProjectAccess = 'allowed' | 'denied' | 'unknown'
export interface ProjectCuration {
  id: string
  state: 'queued' | 'running' | 'waiting' | 'needs_attention' | 'done' | 'failed' | 'stopped'
  started_at: string | null
  actor_name: string | null
}
export interface Project {
  project_id: string
  name: string
  status: string
  curation?: ProjectCuration | null
  origin?: 'local' | 'zentao'
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
  ids?: string[]
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
  allowed: '可操作',
  denied: '只读查看',
  unknown: '操作权限待确认',
}

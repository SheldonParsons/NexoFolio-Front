import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { api, ApiError } from '@/api'
import pageSchema from '@/contracts/catalog-preview/1.4.0/page.schema.json'
import detailSchema from '@/contracts/catalog-preview/1.4.0/detail.schema.json'
import type {
  CatalogPreviewPage,
  CatalogPreviewDetail,
  PreviewStatus,
} from '@/contracts/catalog-preview/1.4.0/types.generated'

export type PreviewPage = CatalogPreviewPage
export interface PreviewSource {
  list(
    projectId: string,
    page: number,
    signal: AbortSignal,
    options?: { status?: PreviewStatus; limit?: number },
  ): Promise<CatalogPreviewPage>
  detail(projectId: string, taskId: string, signal: AbortSignal): Promise<CatalogPreviewDetail>
}
const ajv = new Ajv2020({ strict: true, allErrors: false })
addFormats(ajv)
// Schemars includes Rust numeric formats. Keep strict schema validation enabled.
ajv.addFormat('uint', {
  type: 'number',
  validate: (value: number) => Number.isSafeInteger(value) && value >= 0,
})
ajv.addFormat('uint32', {
  type: 'number',
  validate: (value: number) => Number.isInteger(value) && value >= 0 && value <= 4294967295,
})
ajv.addFormat('int64', { type: 'number', validate: Number.isSafeInteger })
ajv.addFormat('double', { type: 'number', validate: Number.isFinite })
const validatePage = ajv.compile<CatalogPreviewPage>(pageSchema)
const validateDetail = ajv.compile<CatalogPreviewDetail>(detailSchema)
const path = (id: string) => `v1/projects/${encodeURIComponent(id)}/catalog-previews`

export function createPreviewSource(request: typeof api.request): PreviewSource {
  return {
    async list(projectId, page, signal, options = {}) {
      const limit = options.limit ?? 20
      const query = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (options.status) query.set('status', options.status)
      const value = await request<unknown>(`${path(projectId)}?${query}`, {
        signal,
        cache: 'no-store',
      })
      if (
        !validatePage(value) ||
        value.page !== page ||
        value.limit !== limit ||
        value.total < 0 ||
        value.items.length > limit ||
        value.items.length > value.total ||
        (value.items.length === 0 && (page - 1) * limit < value.total) ||
        (options.status && value.items.some((item) => item.status !== options.status))
      )
        throw new ApiError(
          '候选任务列表与当前契约或查询条件不匹配，请重新读取。',
          'invalid-response',
        )
      return value
    },
    async detail(projectId, taskId, signal) {
      const value = await request<unknown>(`${path(projectId)}/${encodeURIComponent(taskId)}`, {
        signal,
        cache: 'no-store',
      })
      if (
        !validateDetail(value) ||
        value.task.task_id !== taskId ||
        value.task.snapshot.project_id !== projectId
      )
        throw new ApiError('候选详情与当前项目或任务契约不匹配。', 'invalid-response')
      return value
    },
  }
}
// Always read actual project-scoped previews; failures never fall back to generated examples.
export const previewSource = createPreviewSource(api.request)

import { ApiError } from '@/api/client'
import { readCredential } from '@/api/session'
import { createEvidenceReader, type EvidenceReader } from './evidence'
import { maintenanceSource, maintenancePath, type MaintenanceSource } from './source'
import type {
  KnowledgeSnapshot,
  MaintenanceRun,
} from '@/contracts/maintenance/2.0.0/types.generated'

export function maintenanceEvidenceReader(
  context: () => { run?: MaintenanceRun | null; snapshot?: KnowledgeSnapshot | null },
  source: MaintenanceSource = maintenanceSource,
): EvidenceReader {
  const images = createEvidenceReader({
    baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
    origin: window.location.origin,
    pathFor: (project, id) => `${maintenancePath(project)}/assets/${encodeURIComponent(id)}`,
    getAccessToken: () => readCredential()?.token,
    maxBytes: 8 * 1024 * 1024,
  })
  return {
    async read(project, ref, signal) {
      if (ref.projectId !== project) throw new ApiError('证据不属于当前项目。', 'invalid-response')
      if (ref.resource === 'image') return images.read(project, ref, signal)
      if (ref.resource === 'fact') {
        const value = await source.fact(project, ref.id, signal)
        return {
          kind: 'text',
          text: JSON.stringify(value, null, 2),
          related: value.samples.map((id) => ({
            projectId: project,
            id,
            kind: 'text' as const,
            resource: 'observation' as const,
            label: `原始事件 ${id}`,
          })),
        }
      }
      if (ref.resource === 'observation') {
        const value = await source.observation(project, ref.id, signal)
        return {
          kind: 'text',
          text: `${value.payload_available ? '原始事件与载荷' : '原始载荷已不可用，以下仅为保留的事件元数据'}\n${JSON.stringify(value, null, 2)}`,
        }
      }
      if (ref.resource === 'unknown')
        throw new ApiError('服务尚未提供此类引用的正文，未读取内容。', 'invalid-response')
      const current = context()
      const runId = ref.runId ?? current.run?.id
      if (!runId) throw new ApiError('证据缺少所属任务，无法定位快照。', 'invalid-response')
      if (ref.resource === 'summary') {
        let page = 1
        while (true) {
          const value = await source.checkpoints(project, runId, page, signal)
          const checkpoint = value.items.find((item) => item.id === ref.id)
          if (checkpoint) return { kind: 'text', text: JSON.stringify(checkpoint, null, 2) }
          if (page * value.limit >= value.total || !value.items.length) break
          page++
        }
        throw new ApiError('未找到对应检查点摘要，未读取内容。', 'http', 404)
      }
      const run =
        current.run?.id === runId && current.run.project_id === project
          ? current.run
          : await source.run(project, runId, signal)
      const snapshot =
        current.snapshot?.id === run.snapshot_id && current.snapshot.project_id === project
          ? current.snapshot
          : await source.snapshot(project, runId, run.snapshot_id, signal)
      if (ref.resource === 'snapshot') {
        if (ref.id !== snapshot.id) throw new ApiError('快照引用不匹配。', 'invalid-response')
        return { kind: 'text', text: JSON.stringify(snapshot, null, 2) }
      }
      if (ref.resource === 'interface') {
        const value = snapshot.interfaces.find((item) => item.interface_id === ref.id)
        if (!value) throw new ApiError('来源任务快照中没有找到此接口。', 'http', 404)
        return {
          kind: 'text',
          text: JSON.stringify({ source_run_id: run.id, snapshot_id: snapshot.id, interface: value }, null, 2),
        }
      }
      const value =
        ref.resource === 'field'
          ? snapshot.fields.find((item) => item.id === ref.id)
          : ref.resource === 'directory'
            ? snapshot.catalog.nodes.find((item) => item.id === ref.id)
            : undefined
      if (!value) throw new ApiError('此快照中没有找到对应证据，未读取内容。', 'http', 404)
      return {
        kind: 'text',
        text: JSON.stringify({ snapshot_id: snapshot.id, evidence: value }, null, 2),
      }
    },
  }
}

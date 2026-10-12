import { pageVisible, waitForObservation } from '@/features/curation/observation'
import { computed, ref, shallowRef } from 'vue'
import * as knowledge from '@/contracts/knowledge/source'
import type { CurateProgress } from '@/contracts/knowledge/types'
import * as source from './source'
import type { DocumentRequests, DocumentErrorReporter } from './documentRequests'
import { reconnectCuration, temporaryCurationReadFailure } from './curationConnection'

type CurationWorkspace = {
  canStart: () => boolean
  selectedId: () => string
  setIndex: (index: source.DocumentIndex) => void
  refreshDetail: (id: string) => Promise<void>
}

/** Job start/resume, progress polling and incremental document refresh. */
export function useDocumentCuration(
  projectId: () => string,
  requests: DocumentRequests,
  report: DocumentErrorReporter,
  workspace: CurationWorkspace,
) {
  const describing = ref('')
  const organizing = ref(false)
  const progress = shallowRef<CurateProgress | null>(null)
  const notice = ref('')
  const noticeError = ref(false)
  const noticeCandidateId = ref('')
  const requestedRunKey = ref('')
  const busy = computed(() => organizing.value || !!describing.value)
  const progressText = computed(() => {
    const value = progress.value
    if (!value || value.status !== 'running') return ''
    if (value.message) return value.message
    return value.stage === 'organize'
      ? '接口与字段知识已更新，正在整理目录'
      : value.stage === 'fields'
        ? '正在更新字段知识 ' + (value.fields_completed ?? 0) + '/' + value.total
        : '正在补全接口说明 ' + value.completed + '/' + value.total
  })
  const waitForProgress = (signal: AbortSignal) => waitForObservation(signal, 2000)
  async function curate(endpointId?: string, resumed?: CurateProgress, resumeId?: string) {
    if (busy.value || !workspace.canStart()) return
    const pid = projectId()
    const request = requests.begin('curate')
    const current = request.current
    describing.value = endpointId ?? ''
    organizing.value = !endpointId
    progress.value = resumed ?? null
    notice.value = ''
    noticeError.value = false
    noticeCandidateId.value = resumed?.candidate_id ?? resumeId ?? ''
    const refresh = async (details: boolean) => {
      if (!pageVisible()) await waitForObservation(request.signal)
      const updated = await source.documentIndex(pid, request.signal)
      if (!current()) return
      workspace.setIndex(updated)
      if (
        details &&
        workspace.selectedId() &&
        (!endpointId || workspace.selectedId() === endpointId)
      )
        await workspace.refreshDetail(workspace.selectedId())
    }
    try {
      const recover = () => {
        if (current()) notice.value = '暂时无法读取进度，正在重新连接后台整理任务'
      }
      const readProgress = () =>
        reconnectCuration(
          pid,
          request.signal,
          () => waitForProgress(request.signal),
          recover,
          progress.value?.run_id ?? progress.value?.candidate_id ?? '',
        )
      let job: CurateProgress
      try {
        job =
          resumed ??
          (resumeId
            ? await knowledge.resumeCandidate(pid, resumeId, request.signal)
            : endpointId
              ? await knowledge.describeEndpoint(pid, endpointId, request.signal)
              : await knowledge.startCurate(pid, request.signal))
      } catch (cause) {
        if (!temporaryCurationReadFailure(cause) || !current()) throw cause
        recover()
        job = await readProgress()
        if (resumeId && job.candidate_id !== resumeId)
          throw new Error('无法确认本轮恢复状态，请重新读取本轮进度。')
        if (job.status === 'idle')
          throw new Error('启动请求未确认，目前未发现运行中的整理任务，请重试。')
      }
      noticeCandidateId.value = job.candidate_id ?? noticeCandidateId.value
      if (!resumed) requestedRunKey.value = job.run_id ?? job.candidate_id ?? ''
      let shown = -1
      while (current()) {
        progress.value = job
        if (job.status === 'done' && job.candidate_id) {
          notice.value = '候选整理已完成，审阅并应用后才会更新现行文档'
          break
        }
        if (job.status === 'done') {
          try {
            await refresh(true)
          } catch (cause) {
            if (!temporaryCurationReadFailure(cause)) throw cause
            if (current()) {
              noticeError.value = true
              notice.value = '后台整理已完成，页面读取暂时失败，请刷新查看结果。'
            }
            break
          }
          if (current())
            notice.value =
              '文档整理完成，补全 ' +
              job.generated +
              ' 个接口说明，复用 ' +
              job.unchanged +
              ' 个已有说明，更新 ' +
              (job.fields_updated ?? 0) +
              ' 个字段'
          break
        }
        if (job.status === 'idle') throw new Error('整理被中断，已完成内容会保留，请再次整理。')
        if (job.status === 'failed') throw new Error(job.message || '整理暂时无法完成，请重试。')
        if (!job.candidate_id && job.completed + (job.fields_completed ?? 0) > shown) {
          try {
            await refresh(job.stage === 'fields')
            shown = job.completed + (job.fields_completed ?? 0)
          } catch (cause) {
            if (!temporaryCurationReadFailure(cause)) throw cause
            recover()
          }
        }
        if (!current()) return
        await waitForProgress(request.signal)
        job = await readProgress()
      }
    } catch (cause) {
      if (current()) {
        noticeError.value = true
        report(cause, notice)
      }
    } finally {
      if (current()) {
        describing.value = ''
        organizing.value = false
      }
    }
  }
  function reset() {
    requests.cancel('curate')
    describing.value = ''
    organizing.value = false
    progress.value = null
    notice.value = ''
    noticeError.value = false
    noticeCandidateId.value = ''
    requestedRunKey.value = ''
  }
  const reviewPath = computed(
    () =>
      `/projects/${encodeURIComponent(projectId())}/interfaces/curation${progress.value?.candidate_id ? '/' + encodeURIComponent(progress.value.candidate_id) : ''}`,
  )
  return {
    reviewPath,
    describing,
    organizing,
    progress,
    progressText,
    busy,
    notice,
    noticeError,
    noticeCandidateId,
    requestedRunKey,
    reset,
    describe: (id: string) => (id ? curate(id) : Promise.resolve()),
    organize: () => curate(),
    viewProgress: (job: CurateProgress) => curate(job.target ?? undefined, job),
    fillGaps: (id?: string) => {
      const candidate = id ?? progress.value?.candidate_id
      return candidate ? curate(undefined, undefined, candidate) : Promise.resolve()
    },
    cancel: async (id?: string) => {
      const candidate = id ?? progress.value?.candidate_id
      if (!candidate) return
      noticeCandidateId.value = candidate
      try {
        await knowledge.cancelCandidate(projectId(), candidate)
      } catch (cause) {
        noticeError.value = true
        report(cause, notice)
      }
    },
  }
}

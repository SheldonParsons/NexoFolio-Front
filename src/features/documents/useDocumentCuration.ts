import { sameExecution } from '@/features/curation/progressIdentity'
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
  const submitting = ref(false)
  const submittingTarget = ref('')
  const watching = ref(false)
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
  async function observe(initial: CurateProgress) {
    if (!workspace.canStart() || (watching.value && sameExecution(progress.value, initial))) return
    const pid = projectId()
    const request = requests.begin('curate')
    const current = request.current
    const endpointId = initial.target ?? undefined
    describing.value = endpointId ?? ''
    organizing.value = !endpointId
    watching.value = true
    progress.value = initial
    requestedRunKey.value = initial.task_id ?? initial.run_id ?? initial.candidate_id ?? ''
    notice.value = ''
    noticeError.value = false
    noticeCandidateId.value = initial.candidate_id ?? ''
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
          progress.value?.task_id
            ? `task:${progress.value.task_id}`
            : (progress.value?.run_id ?? progress.value?.candidate_id ?? ''),
        )
      let job = initial
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
        if (job.task_state === 'stopped') {
          notice.value = job.candidate_id ? '任务已停止，已保存批次保留' : '排队已取消'
          break
        }
        if (job.status === 'idle') throw new Error('整理被中断，已完成内容会保留，请再次整理。')
        if (job.status === 'failed') throw new Error(job.message || '整理暂时无法完成，请重试。')
        if (
          !job.task_id &&
          !job.candidate_id &&
          job.completed + (job.fields_completed ?? 0) > shown
        ) {
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
        watching.value = false
        describing.value = ''
        organizing.value = false
      }
    }
  }
  async function submit(endpointId?: string, resumeId?: string) {
    if (submitting.value || !workspace.canStart()) return
    const pid = projectId(),
      request = requests.begin('curate-submit')
    submitting.value = true
    submittingTarget.value = endpointId ?? ''
    if (!watching.value) {
      describing.value = endpointId ?? ''
      organizing.value = !endpointId
    }
    notice.value = ''
    noticeError.value = false
    let accepted: CurateProgress | undefined
    try {
      try {
        accepted = resumeId
          ? await knowledge.resumeCandidate(pid, resumeId, request.signal)
          : endpointId
            ? await knowledge.describeEndpoint(pid, endpointId, request.signal)
            : await knowledge.startCurate(pid, request.signal)
      } catch (cause) {
        if (!temporaryCurationReadFailure(cause) || !request.current()) throw cause
        // An uncertain response does not authorize replaying the POST or adopting the selected old task.
        let found = await reconnectCuration(
          pid,
          request.signal,
          () => waitForProgress(request.signal),
          () => {},
        )
        const matches = (job: CurateProgress) =>
          resumeId ? job.candidate_id === resumeId : (job.target ?? null) === (endpointId ?? null)
        if (!matches(found)) {
          const tasks = await knowledge.activeCurationTasks(pid, request.signal)
          const task = tasks.find((t) =>
            resumeId ? t.candidate_id === resumeId : t.target === (endpointId ?? null),
          )
          if (!task) throw new Error('尚未确认本次提交；当前任务继续执行，请查看活动任务或重试。')
          found = await knowledge.curateProgress(pid, request.signal, `task:${task.id}`)
        }
        if (!matches(found) || found.status === 'idle')
          throw new Error('尚未确认本次提交，请重新读取任务状态或重试。')
        accepted = found
      }
    } catch (cause) {
      if (request.current()) {
        noticeError.value = true
        noticeCandidateId.value = resumeId ?? progress.value?.candidate_id ?? ''
        report(cause, notice)
      }
    } finally {
      if (request.current()) {
        submitting.value = false
        if (!watching.value) {
          describing.value = ''
          organizing.value = false
        }
      }
    }
    if (accepted && request.current()) await observe(accepted)
  }
  function reset() {
    requests.cancel('curate')
    requests.cancel('curate-submit')
    requests.cancel('curate-stop')
    submitting.value = false
    watching.value = false
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
    submitting,
    submittingTarget,
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
    describe: (id: string) => (id ? submit(id) : Promise.resolve()),
    organize: () => submit(),
    viewProgress: observe,
    fillGaps: (id?: string) => {
      const candidate = id ?? progress.value?.candidate_id
      return candidate ? submit(undefined, candidate) : Promise.resolve()
    },
    cancel: async (id?: string, selection?: CurateProgress | null) => {
      const candidate = id ?? progress.value?.task_id ?? progress.value?.candidate_id
      if (!candidate) return
      const pid = projectId(),
        selected = selection ?? progress.value,
        request = requests.begin('curate-stop')
      noticeCandidateId.value = candidate
      const owns = () =>
        request.current() &&
        (!progress.value || (!!selected && sameExecution(progress.value, selected)))
      try {
        if (candidate === selected?.task_id)
          await knowledge.stopCurationTask(pid, candidate, request.signal)
        else await knowledge.cancelCandidate(pid, candidate, request.signal)
        if (selected?.task_state === 'needs_attention' && selected.task_id) {
          const stopped = await knowledge.curateProgress(
            pid,
            request.signal,
            `task:${selected.task_id}`,
          )
          if (owns()) {
            progress.value = stopped
            notice.value = '任务已停止，已保存批次保留'
            noticeError.value = false
          }
        }
      } catch (cause) {
        if (owns()) {
          noticeError.value = true
          report(cause, notice)
        }
      }
    },
  }
}

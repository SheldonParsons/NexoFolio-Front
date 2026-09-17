import { onScopeDispose, ref, watch } from 'vue'
import type { EvidenceReader } from './evidence'
import type { EvidenceRef } from './models'
import { ApiError } from '@/api/client'
export function useEvidence(
  projectId: () => string,
  reference: () => EvidenceRef | null,
  reader: EvidenceReader,
  unauthorized: () => void,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
) {
  const text = ref('')
  const imageUrl = ref('')
  const busy = ref(false)
  const error = ref('')
  const related = ref<EvidenceRef[]>([])
  let request: AbortController | undefined
  function clear() {
    request?.abort()
    if (imageUrl.value) urls.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
    text.value = ''
    busy.value = false
    error.value = ''
    related.value = []
  }
  async function load() {
    clear()
    const target = reference()
    if (!target) return
    if (target.projectId !== projectId()) {
      error.value = '证据不属于当前项目。'
      return
    }
    const controller = new AbortController()
    request = controller
    busy.value = true
    try {
      const content = await reader.read(projectId(), target, controller.signal)
      if (controller.signal.aborted || request !== controller) return
      if (content.kind !== target.kind) throw new ApiError('证据类型不匹配。', 'invalid-response')
      related.value = (content.related ?? []).filter((ref) => ref.projectId === projectId())
      if (content.kind === 'text') text.value = content.text
      else imageUrl.value = urls.createObjectURL(content.blob)
    } catch (cause) {
      if (controller.signal.aborted || request !== controller) return
      error.value = cause instanceof Error ? cause.message : '证据读取失败。'
      if (cause instanceof ApiError && cause.status === 401) unauthorized()
    } finally {
      if (!controller.signal.aborted && request === controller) busy.value = false
    }
  }
  watch(
    () => [
      projectId(),
      reference()?.id,
      reference()?.projectId,
      reference()?.kind,
      reference()?.resource,
      reference()?.runId,
    ],
    () => {
      void load()
    },
    { immediate: true },
  )
  onScopeDispose(clear)
  return { text, imageUrl, busy, error, related, load }
}

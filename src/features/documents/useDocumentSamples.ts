import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import * as source from './source'
import type { DocumentErrorReporter } from './documentRequests'

/** Scoped reads/cache and comparison selection; never clears a rendered sample while refreshing it. */
export function useDocumentSamples(
  projectId: () => string,
  endpointId: () => string,
  environmentId: () => string,
  report: DocumentErrorReporter,
  readOnly = false,
) {
  const sample = shallowRef<unknown | null>(null)
  const sampleId = ref(''),
    displayedSampleId = ref(''),
    sampleError = ref(''),
    sampleLoading = ref(false)
  const comparisonIds = ref<string[]>([])
  const baselineId = ref('')
  const cached = new Map<string, unknown>()
  const payloads = shallowRef(new Map<string, unknown>())
  const errors = shallowRef(new Map<string, string>())
  const pending = shallowRef(new Set<string>())
  const inflight = new Map<string, { controller: AbortController; promise: Promise<unknown> }>()
  let epoch = 0
  const scope = () => [projectId(), endpointId(), environmentId()].join(':')
  async function read(id: string): Promise<unknown> {
    const ownedScope = scope(),
      generation = epoch
    const key = ownedScope + ':' + id
    if (cached.has(key)) {
      const value = cached.get(key)
      payloads.value = new Map(payloads.value).set(id, value)
      return value
    }
    const current = inflight.get(key)
    if (current) return current.promise
    const controller = new AbortController()
    const pid = projectId(),
      endpoint = endpointId()
    pending.value = new Set(pending.value).add(id)
    const promise = source
      .example(pid, endpoint, id, controller.signal, readOnly)
      .then((value) => {
        if (controller.signal.aborted || generation !== epoch || ownedScope !== scope()) return null
        cached.delete(key)
        cached.set(key, value.observation)
        while (cached.size > 12) cached.delete(cached.keys().next().value!)
        payloads.value = new Map(payloads.value).set(id, value.observation)
        const next = new Map(errors.value)
        next.delete(id)
        errors.value = next
        return value.observation
      })
      .catch((cause) => {
        if (!controller.signal.aborted && generation === epoch && ownedScope === scope()) {
          const message = { value: '' }
          report(cause, message)
          errors.value = new Map(errors.value).set(id, message.value)
        }
        throw cause
      })
      .finally(() => {
        if (inflight.get(key)?.controller === controller) inflight.delete(key)
        if (generation === epoch) {
          const next = new Set(pending.value)
          next.delete(id)
          pending.value = next
        }
      })
    inflight.set(key, { controller, promise })
    return promise
  }
  async function selectExample(id: string) {
    const generation = epoch
    sampleId.value = id
    sampleError.value = ''
    sampleLoading.value = true
    try {
      const value = await read(id)
      if (generation === epoch && sampleId.value === id) {
        sample.value = value
        displayedSampleId.value = id
      }
    } catch {
      if (generation === epoch && sampleId.value === id)
        sampleError.value = errors.value.get(id) ?? '暂时无法读取样本'
    } finally {
      if (generation === epoch && sampleId.value === id) sampleLoading.value = false
    }
  }
  async function toggleComparison(id: string) {
    if (comparisonIds.value.includes(id)) {
      comparisonIds.value = comparisonIds.value.filter((value) => value !== id)
      if (baselineId.value === id) baselineId.value = comparisonIds.value[0] ?? ''
      return
    }
    if (comparisonIds.value.length >= 4) return
    comparisonIds.value = [...comparisonIds.value, id]
    if (!baselineId.value) baselineId.value = id
    try {
      await read(id)
    } catch {
      /* Per-sample error remains visible beside its selection. */
    }
  }
  function reset() {
    epoch++
    for (const request of inflight.values()) request.controller.abort()
    inflight.clear()
    sample.value = null
    sampleId.value = ''
    displayedSampleId.value = ''
    sampleError.value = ''
    sampleLoading.value = false
    comparisonIds.value = []
    baselineId.value = ''
    payloads.value = new Map()
    errors.value = new Map()
    pending.value = new Set()
  }
  onScopeDispose(reset)
  return {
    sample,
    sampleId,
    displayedSampleId,
    sampleError,
    sampleLoading,
    comparisonIds,
    baselineId,
    samplePayloads: payloads,
    sampleErrors: errors,
    samplesPending: pending,
    comparisonReady: computed(
      () =>
        comparisonIds.value.length >= 2 &&
        comparisonIds.value.every((id) => payloads.value.has(id)),
    ),
    selectExample,
    toggleComparison,
    resetSamples: reset,
    retrySample: async (id: string) => {
      cached.delete(scope() + ':' + id)
      return selectExample(id)
    },
    clearComparison: () => {
      comparisonIds.value = []
      baselineId.value = ''
    },
  }
}

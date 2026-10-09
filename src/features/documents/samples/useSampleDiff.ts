import { onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { DiffInput, SampleDiffResult } from './diff'
export function useSampleDiff(inputs: () => DiffInput[], align: () => 'position' | 'id') {
  const result = shallowRef<SampleDiffResult | null>(null),
    loading = ref(false),
    error = ref('')
  const worker = new Worker(new URL('./sampleDiff.worker.ts', import.meta.url), { type: 'module' })
  let id = 0
  worker.onmessage = (
    event: MessageEvent<{ id: number; result?: SampleDiffResult; error?: string }>,
  ) => {
    if (event.data.id !== id) return
    loading.value = false
    error.value = event.data.error ?? ''
    if (event.data.result) result.value = event.data.result
  }
  worker.onerror = () => {
    loading.value = false
    error.value = '差异计算暂时失败，请重新选择样本'
  }
  watch(
    [inputs, align],
    () => {
      const values = inputs()
      id++
      error.value = ''
      if (values.length < 2) {
        result.value = null
        loading.value = false
        return
      }
      loading.value = true
      worker.postMessage({ id, inputs: values, align: align() })
    },
    { immediate: true },
  )
  onScopeDispose(() => worker.terminate())
  return { result, loading, error }
}

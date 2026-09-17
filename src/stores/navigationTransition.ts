import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useNavigationTransition = defineStore('navigation-transition', () => {
  const current = ref<{
    runId: number
    durationMs?: number
    minimumDurationMs?: number
    pending: boolean
    label: string
  } | null>(null)
  let sequence = 0
  function start(label: string, durationMs?: number, minimumDurationMs?: number) {
    const runId = ++sequence
    current.value = { runId, label, durationMs, minimumDurationMs, pending: true }
    return runId
  }
  function settle(runId: number) {
    if (current.value?.runId === runId) current.value.pending = false
  }
  function finish(runId: number) {
    if (current.value?.runId === runId) current.value = null
  }
  return { current, start, settle, finish }
})

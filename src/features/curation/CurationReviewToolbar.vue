<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import './review-toolbar.css'
type View = 'document' | 'changes' | 'issues'
const props = defineProps<{
  modelValue: View
  issues: number
}>()
defineEmits<{ 'update:modelValue': [value: View] }>()
const views: { value: View; label: string }[] = [
  { value: 'document', label: '完整候选文档' },
  { value: 'changes', label: '变化对比' },
  { value: 'issues', label: '未完成与待处理' },
]
const tabs = ref<HTMLDivElement | null>(null)
const indicator = ref({ x: 0, width: 0 })
let observer: ResizeObserver | undefined
function measure() {
  const selected = tabs.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
  if (selected) indicator.value = { x: selected.offsetLeft, width: selected.offsetWidth }
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (tabs.value) {
    observer.observe(tabs.value)
    tabs.value.querySelectorAll('button').forEach((button) => observer!.observe(button))
  }
})
watch([() => props.modelValue, () => props.issues], () => void nextTick(measure), {
  flush: 'post',
})
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div class="curation-review-tools">
    <div ref="tabs" class="curation-review-tabs" role="group" aria-label="整理结果视图">
      <span
        class="curation-review-tab-indicator"
        aria-hidden="true"
        :data-ready="indicator.width > 0"
        :style="{
          transform: `translate3d(${indicator.x}px, 0, 0)`,
          width: `${indicator.width}px`,
        }"
      />
      <button
        v-for="view in views"
        :key="view.value"
        type="button"
        :aria-pressed="modelValue === view.value"
        @click="$emit('update:modelValue', view.value)"
      >
        {{ view.label }}<small v-if="view.value === 'issues' && issues">{{ issues }}</small>
      </button>
    </div>
  </div>
</template>

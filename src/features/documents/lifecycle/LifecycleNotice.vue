<script setup lang="ts">
import { computed } from 'vue'
import { useLifecycle } from './context'
import type { LifecycleTarget } from './model'
const props = defineProps<{ target: LifecycleTarget }>()
const lifecycle = useLifecycle()
const decision = computed(() => lifecycle?.get(props.target))
</script>
<template>
  <p v-if="decision" class="lifecycle-notice">
    {{ decision.reason }} · {{ decision.actor.display_name || '操作人未记录' }} ·
    {{ new Date(decision.at).toLocaleString('zh-CN')
    }}<span v-if="decision.version > (lifecycle?.state.value.reconciled_version ?? 0)">
      · 等待下一轮整理核对</span
    >
  </p>
</template>
<style scoped>
.lifecycle-notice {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text);
  overflow-wrap: anywhere;
}
</style>

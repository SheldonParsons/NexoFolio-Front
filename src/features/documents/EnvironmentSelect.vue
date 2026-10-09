<script setup lang="ts">
import { computed } from 'vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import type { ProjectEnvironment } from './types'
const props = defineProps<{ environments: ProjectEnvironment[]; modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const options = computed(() =>
  props.environments.map((env) => ({ value: env.id, label: env.name })),
)
</script>
<template>
  <div class="environment-select">
    <AppSelect
      :model-value="modelValue"
      :options="options"
      label="项目环境"
      placeholder="选择环境"
      size="compact"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>
<style scoped>
.environment-select {
  flex: 0 1 auto;
  min-width: 0;
}
.environment-select :deep(.nf-select-trigger > span:first-child) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
</style>

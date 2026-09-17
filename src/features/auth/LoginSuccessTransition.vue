<script setup lang="ts">
import BrandTransition from '@/components/brand/BrandTransition.vue'
defineProps<{ runId: number }>()
const emit = defineEmits<{ complete: [runId: number] }>()
</script>
<template>
  <BrandTransition
    :run-id="runId"
    :duration-ms="3000"
    label="登录成功，正在进入 NexoFolio"
    @complete="emit('complete', $event)"
  />
</template>

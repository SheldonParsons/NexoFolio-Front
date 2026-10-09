<script setup lang="ts">
import AppDialog from '@/components/ui/AppDialog.vue'
import AppButton from '@/components/ui/AppButton.vue'
defineProps<{ message: string; retryable: boolean }>()
const emit = defineEmits<{ 'update:message': [value: string]; retry: [] }>()
</script>
<template>
  <AppDialog
    :open="!!message"
    title="整理结果"
    :description="message"
    @update:open="!$event && emit('update:message', '')"
  >
    <div class="curation-entry-notice-actions">
      <AppButton variant="primary" @click="retryable ? emit('retry') : emit('update:message', '')">
        {{ retryable ? '重新读取' : '知道了' }}
      </AppButton>
    </div>
  </AppDialog>
</template>
<style scoped>
.curation-entry-notice-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>

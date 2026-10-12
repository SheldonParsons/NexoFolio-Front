<script setup lang="ts">
import { useLifecycle } from './lifecycle/context'
const lifecycle = useLifecycle()
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import EnvironmentSelect from './EnvironmentSelect.vue'
import type { ProjectEnvironment } from './types'
import { useCurationReviewEntry } from '@/features/curation/useCurationReviewEntry'
import CurationEntryNotice from '@/features/curation/CurationEntryNotice.vue'
const props = defineProps<{
  projectId: string
  name: string
  endpointCount: number
  folderCount: number
  environments: ProjectEnvironment[]
  environmentId: string
  busy: boolean
  loading: boolean
}>()
defineEmits<{ environment: [id: string]; organize: [] }>()
const route = useRoute(),
  router = useRouter()
const review = useCurationReviewEntry(
  () => props.projectId,
  () => props.environmentId,
  (to) => router.push(to),
  () => route.fullPath,
)
</script>
<template>
  <header class="document-workspace-heading">
    <div class="document-project-context">
      <RouterLink to="/projects" class="document-project-return" aria-label="返回项目列表"
        ><AppIcon name="arrow-left" :size="18"
      /></RouterLink>
      <div>
        <h1>{{ name }}</h1>
        <p class="document-project-summary">
          {{ endpointCount }} 个接口 · {{ folderCount }} 个目录
        </p>
      </div>
    </div>
    <div class="document-heading-actions">
      <EnvironmentSelect
        v-if="environments.length"
        :environments="environments"
        :model-value="environmentId"
        @update:model-value="$emit('environment', $event)"
      />
      <span v-else class="document-environment-state">{{
        loading ? '读取环境中…' : '暂无环境'
      }}</span>
      <button
        type="button"
        class="document-review-entry"
        :disabled="review.loading.value"
        :aria-busy="review.loading.value"
        @click="review.open"
      >
        {{ review.loading.value ? '读取中…' : '整理结果' }}
      </button>
      <button
        v-if="lifecycle"
        type="button"
        class="document-review-entry"
        @click="lifecycle.panelOpen.value = true"
      >
        废弃内容（{{ lifecycle.count.value }}）
      </button>
      <button
        type="button"
        class="document-organize"
        :disabled="busy || loading || !endpointCount"
        :aria-busy="busy"
        title="生成目录、接口与字段知识的候选结果，审阅后再应用"
        @click="$emit('organize')"
      >
        <AppIcon name="layers" :size="16" /><span>{{ busy ? '正在整理' : '开始新一轮整理' }}</span>
      </button>
    </div>
  </header>
  <p v-if="lifecycle?.pending.value" class="lifecycle-project-notice" role="status">
    存在废弃变更，当前整理尚未重新核对
  </p>
  <CurationEntryNotice
    v-model:message="review.message.value"
    :retryable="review.retryable.value"
    @retry="review.open"
  />
</template>
<style scoped>
.document-review-entry {
  flex: none;
  color: var(--muted);
  text-decoration: none;
  padding: 6px 8px;
  border-radius: 5px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition:
    background 160ms,
    color 160ms;
}
.document-review-entry:hover {
  background: var(--surface-muted);
  color: var(--text);
}
@media (max-width: 760px) {
  .document-review-entry {
    margin-left: auto;
  }
}
</style>

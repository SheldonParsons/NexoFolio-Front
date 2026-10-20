<script setup lang="ts">
import { useLifecycle } from './lifecycle/context'
const lifecycle = useLifecycle()
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
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
  submitting: boolean
  loading: boolean
  readOnly?: boolean
}>()
defineEmits<{ environment: [id: string]; organize: [] }>()
const route = useRoute(),
  router = useRouter()
const auth = useAuthStore()
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
      <RouterLink
        :to="auth.user ? '/projects' : '/'"
        class="document-project-return"
        aria-label="返回项目列表"
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
        v-if="!readOnly"
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
        v-if="!readOnly"
        type="button"
        class="document-organize"
        :disabled="submitting || loading || !endpointCount"
        :aria-busy="submitting"
        title="生成目录、接口与字段知识的候选结果，审阅后再应用"
        @click="$emit('organize')"
      >
        <AppIcon name="layers" :size="16" /><span>{{
          submitting ? '正在提交' : '开始新一轮整理'
        }}</span>
      </button>
      <span v-if="readOnly" class="document-description-source">只读查看</span>
      <button
        v-if="readOnly && !auth.user"
        type="button"
        class="document-secondary-button"
        @click="auth.requestLogin(route.fullPath)"
      >
        登录
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

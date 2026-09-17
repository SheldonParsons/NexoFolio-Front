<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { catalogOrigin } from './origin'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import { formatTime } from '@/features/documents/presentation'
import { previewError } from '@/features/catalog-preview/model'
import { ApiError } from '@/api/client'
import type { CatalogSource, CatalogVersionPage } from './types'

const props = defineProps<{
  projectId: string
  activeId: string | null
  source: CatalogSource
  generation: number
}>()
const emit = defineEmits<{ restore: [versionId: string | null]; unauthorized: [] }>()
const page = shallowRef<CatalogVersionPage | null>(null)
const busy = ref(false)
const error = ref('')
let request: AbortController | undefined
const pages = computed(() => Math.max(1, Math.ceil((page.value?.total ?? 0) / 20)))
async function load(number = 1) {
  request?.abort()
  const controller = new AbortController()
  request = controller
  busy.value = true
  error.value = ''
  try {
    let result = await props.source.versions(props.projectId, number, controller.signal)
    if (controller.signal.aborted || request !== controller) return
    if (!result.items.length && number > 1)
      result = await props.source.versions(
        props.projectId,
        Math.max(1, Math.ceil(result.total / result.limit)),
        controller.signal,
      )
    if (!controller.signal.aborted && request === controller) page.value = result
  } catch (cause) {
    if (controller.signal.aborted || request !== controller) return
    error.value = previewError(cause)
    if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
  } finally {
    if (!controller.signal.aborted && request === controller) busy.value = false
  }
}
watch(
  () => [props.projectId, props.generation],
  () => {
    page.value = null
    void load()
  },
  { immediate: true },
)
onScopeDispose(() => request?.abort())
</script>
<template>
  <section class="catalog-history" aria-label="目录版本历史">
    <p>回退只切换目录组织方式，接口的当前定义继续保留。</p>
    <div class="catalog-history-row">
      <div>
        <strong>初始状态</strong>
        <p>全部接口归入固定待分类目录</p>
      </div>
      <span v-if="activeId === null">当前生效</span
      ><button
        v-else
        type="button"
        class="document-secondary-button"
        @click="emit('restore', null)"
      >
        选择回退
      </button>
    </div>
    <p v-if="busy" role="status">正在读取历史版本…</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="document-secondary-button" @click="load()">重新读取</button>
    </div>
    <template v-else>
      <div v-for="version in page?.items" :key="version.id" class="catalog-history-row">
        <div>
          <strong>{{ formatTime(version.createdAt) }}</strong>
          <p>
            <code>{{ version.id }}</code>
          </p>
          <RouterLink
            v-if="catalogOrigin(projectId, version)"
            :to="catalogOrigin(projectId, version)!.to"
            >{{ catalogOrigin(projectId, version)!.label }}</RouterLink
          >
        </div>
        <span v-if="version.id === activeId">当前生效</span
        ><button
          v-else
          type="button"
          class="document-secondary-button"
          @click="emit('restore', version.id)"
        >
          选择回退
        </button>
      </div>
      <p v-if="!page?.items.length">暂无发布的历史版本。</p>
      <DocumentPager
        v-if="page"
        :page="page.page"
        :pages="pages"
        :total="page.total"
        :loading="busy"
        label="目录版本历史分页"
        @change="load"
      />
    </template>
  </section>
</template>

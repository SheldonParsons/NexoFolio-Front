<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import { formatTime } from '@/features/documents/presentation'
import KnowledgeChange from './KnowledgeChange.vue'
import { maintenanceSource } from './source'
import { ApiError } from '@/api/client'
import type { KnowledgeVersionPage } from '@/contracts/maintenance/2.0.0/types.generated'
const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ unauthorized: [] }>()
const auth = useAuthStore()
const page = shallowRef<KnowledgeVersionPage | null>(null)
const busy = ref(false)
const error = ref('')
const choice = ref<{ id: string | null } | null>(null)
let request: AbortController | undefined
const pages = computed(() => Math.max(1, Math.ceil((page.value?.total ?? 0) / 20)))
async function load(number = 1) {
  request?.abort()
  const current = new AbortController()
  request = current
  busy.value = true
  error.value = ''
  try {
    const value = await maintenanceSource.versions(props.projectId, number, current.signal)
    if (!current.signal.aborted && request === current) page.value = value
  } catch (cause) {
    if (!current.signal.aborted && request === current) {
      error.value = cause instanceof Error ? cause.message : '版本读取失败'
      if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
    }
  } finally {
    if (!current.signal.aborted && request === current) busy.value = false
  }
}
watch(
  () => props.projectId,
  () => {
    choice.value = null
    page.value = null
    void load()
  },
  { immediate: true },
)
onScopeDispose(() => request?.abort())
</script>
<template>
  <section class="maintenance-panel">
    <header>
      <h2>知识版本 / 统一回退</h2>
      <p>这里的回退同时恢复目录和语义；原有“目录版本回退”仍只调整目录。</p>
    </header>
    <div v-if="choice" class="maintenance-filters">
      <span>目标：{{ choice.id ?? '初始目录与语义' }}</span
      ><KnowledgeChange
        :key="`${projectId}:${auth.user?.id}`"
        :project-id="projectId"
        :intent="{ kind: 'restore', version_id: choice.id }"
        label="确认回退…"
        @changed="load()"
        @unauthorized="emit('unauthorized')"
      />
    </div>
    <div class="catalog-history-row">
      <span>初始状态：全部待分类、无已发布语义</span
      ><button type="button" class="maintenance-action" @click="choice = { id: null }">
        选择初始状态
      </button>
    </div>
    <p v-if="busy" role="status">正在读取版本…</p>
    <div v-else-if="error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="maintenance-action" @click="load()">重新读取</button>
    </div>
    <template v-else
      ><div v-for="version in page?.items" :key="version.id" class="catalog-history-row">
        <div>
          <strong>{{ formatTime(version.created_at) }}</strong>
          <p>{{ version.id }} · {{ version.origin }}</p>
        </div>
        <span v-if="version.current">当前生效</span
        ><button
          v-else
          type="button"
          class="maintenance-action"
          @click="choice = { id: version.id }"
        >
          选择回退
        </button>
      </div>
      <p v-if="!page?.items.length">尚无已发布知识版本。</p>
      <DocumentPager
        v-if="page"
        :page="page.page"
        :pages="pages"
        :total="page.total"
        :loading="busy"
        label="知识版本分页"
        @change="load"
    /></template>
  </section>
</template>

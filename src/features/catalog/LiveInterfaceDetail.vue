<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import DefinitionView from '@/features/documents/DefinitionView.vue'
import InterfaceSemantics from '@/features/maintenance/InterfaceSemantics.vue'
import { liveDocumentSource } from '@/features/documents/source'
import type { InterfaceDetail } from '@/features/documents/types'
import { ApiError } from '@/api/client'
import { previewError } from '@/features/catalog-preview/model'
import type { LiveCatalogInterface } from './types'

const props = defineProps<{ projectId: string; member: LiveCatalogInterface | null }>()
const emit = defineEmits<{ unauthorized: []; changed: [] }>()
const environmentId = ref('')
const definition = shallowRef<InterfaceDetail | null>(null)
const busy = ref(false)
const error = ref('')
let request: AbortController | undefined
const options = computed(
  () => props.member?.environments.map((env) => ({ value: env.id, label: env.name })) ?? [],
)
const staleReference = computed(
  () =>
    definition.value &&
    props.member?.environments.find((env) => env.id === environmentId.value)?.revisionId !==
      definition.value.revision_id,
)
async function load() {
  request?.abort()
  definition.value = null
  error.value = ''
  busy.value = false
  if (!props.member || !environmentId.value) return
  const controller = new AbortController()
  request = controller
  busy.value = true
  try {
    const value = await liveDocumentSource.definition(
      props.projectId,
      environmentId.value,
      props.member.id,
      controller.signal,
    )
    if (controller.signal.aborted || request !== controller) return
    definition.value = value
  } catch (cause) {
    if (controller.signal.aborted || request !== controller) return
    error.value = previewError(cause)
    if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
  } finally {
    if (!controller.signal.aborted && request === controller) busy.value = false
  }
}
watch(
  () => [
    props.projectId,
    props.member?.id,
    props.member?.environments.map((env) => `${env.id}:${env.revisionId}`).join('|'),
  ],
  (next, previous) => {
    if (
      next[0] !== previous?.[0] ||
      next[1] !== previous?.[1] ||
      !props.member?.environments.some((env) => env.id === environmentId.value)
    )
      environmentId.value = props.member?.environments[0]?.id ?? ''
    void load()
  },
  { immediate: true },
)
function selectEnvironment(id: string) {
  environmentId.value = id
  void load()
}
onScopeDispose(() => request?.abort())
</script>
<template>
  <section class="catalog-definition catalog-panel" aria-label="实时接口定义">
    <p v-if="!member" class="catalog-empty">选择原始接口成员，查看各环境的实时定义。</p>
    <div v-else class="catalog-panel-scroll catalog-definition-content">
      <header>
        <span class="http-method">{{ member.method }}</span>
        <h2>
          <code>{{ member.path }}</code>
        </h2>
      </header>
      <p class="catalog-caption">每个成员独立保存资料，此处读取该成员当前环境的实时定义。</p>
      <AppSelect
        :model-value="environmentId"
        :options="options"
        label="接口定义环境"
        placeholder="选择环境"
        :disabled="!options.length"
        @update:model-value="selectEnvironment"
      />
      <p v-if="!options.length" class="catalog-empty">该接口暂无可读取的环境定义。</p>
      <p v-else-if="busy" role="status" class="catalog-empty">正在读取实时定义…</p>
      <div v-else-if="error" role="alert" class="catalog-empty">
        <p>{{ error }}</p>
        <button type="button" class="document-secondary-button" @click="load">重新读取</button>
      </div>
      <template v-else-if="definition">
        <p v-if="staleReference" class="document-notice">
          列表引用与已读取的定义版本不同，可刷新列表并重新读取定义。<button
            type="button"
            class="document-text-button"
            @click="emit('changed')"
          >
            刷新列表引用
          </button>
        </p>
        <DefinitionView :definition="definition.definition" />
        <InterfaceSemantics
          :project-id="projectId"
          :interface-id="definition.interface_id"
          :environment-id="definition.environment.id"
          :revision-id="definition.revision_id"
          @unauthorized="emit('unauthorized')"
        />
      </template>
    </div>
  </section>
</template>

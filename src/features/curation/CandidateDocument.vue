<script setup lang="ts">
import { provideLifecycle } from '@/features/documents/lifecycle/context'
import LifecycleNotice from '@/features/documents/lifecycle/LifecycleNotice.vue'
import { computed, onScopeDispose, shallowRef, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { documentLocation } from '@/features/documents/documentRoutes'
import FieldStructure from '@/features/documents/FieldStructure.vue'
import { groupFields } from '@/features/knowledge/fieldPresentation'
import { endpoint } from '@/contracts/knowledge/source'
import type { EndpointDetail, FieldNote } from '@/contracts/knowledge/types'
import type { Candidate } from './types'
import type { DocumentIndex } from '@/features/documents/source'
import type { DocumentTarget } from '@/features/documents/documentRoutes'
import { documentTree, findFolder, folderPath } from '@/features/documents/documentTree'
import { candidateIndex } from './candidateTree'
import { candidateChanges, type KnowledgeChange } from './changes'
import CandidateTree from './CandidateTree.vue'
import CandidateFolderOverview from './CandidateFolderOverview.vue'
const props = defineProps<{
  candidate: Candidate
  index: DocumentIndex | null
  query?: string
  changes?: KnowledgeChange[]
  indexLoading?: boolean
  indexError?: string
}>()
const lifecycle = provideLifecycle(
  () => props.candidate.project_id,
  () => props.index,
  false,
)
watch(
  () => props.candidate.project_id,
  () => {
    lifecycle.showRetired.value = true
  },
  { immediate: true },
)
const router = useRouter()
function showExample(example: string) {
  const location = documentLocation(
    props.candidate.project_id,
    { kind: 'endpoint', id: selected.value },
    environment.value,
    'examples',
  )
  void router.push({ ...location, query: { ...location.query, sample: example } })
}
const target = ref<DocumentTarget>(null)
const query = computed(() => props.query ?? '')
const selected = computed(() => (target.value?.kind === 'endpoint' ? target.value.id : ''))
const detail = shallowRef<EndpointDetail | null>(null)
const loading = ref(false),
  error = ref('')
const cached = new Map<string, EndpointDetail>()
let request: AbortController | undefined
const projected = computed(() => candidateIndex(props.candidate, props.index))
const entries = computed(() => projected.value.entries)
const tree = computed(() => documentTree(projected.value, null))
const changes = computed(() => props.changes ?? candidateChanges(props.candidate))
const folder = computed(() =>
  target.value?.kind === 'folder' ? findFolder(tree.value, target.value.id) : undefined,
)
const path = computed(() => folderPath(projected.value.catalog.folders, folder.value?.id ?? null))
const folderChange = computed(() =>
  changes.value.find((c) => c.id === 'folders:' + folder.value?.id),
)
watch(
  () => props.candidate.id,
  () => {
    target.value = null
    cached.clear()
  },
)
watch(
  tree,
  (value) => {
    if (!target.value && value.length) target.value = { kind: 'folder', id: value[0]!.id }
  },
  { immediate: true },
)
const note = computed(() => props.candidate.view.notes.find((n) => n.endpoint === selected.value))
const notes = computed(() => {
  const saved = props.candidate.view.fields.filter((f) => f.endpoint === selected.value)
  if (!props.candidate.progress.values_archived) return saved
  const input = props.candidate.execution_input?.prepared.inputs?.[selected.value] ?? []
  return input.map((field): FieldNote => {
    const old = saved.find((n) => n.path === field.key)
    return {
      ...(old ?? { endpoint: selected.value, path: field.key, text: '', values: [] }),
      context: {
        location: field.location,
        field_path: field.path,
        input_hash: null,
        evidence: [],
        completion: {
          name: { state: 'missing', reason: null },
          description: { state: 'missing', reason: null },
        },
        ...old?.context,
        observations: field.observations
          ? { ...field.observations, archive_id: props.candidate.id }
          : old?.context?.observations,
      },
    }
  })
})
const groups = computed(() => groupFields(detail.value?.facts.fields ?? []))
watch(selected, async (id) => {
  request?.abort()
  request = new AbortController()
  const current = request
  error.value = ''
  loading.value = false
  detail.value = cached.get(id) ?? null
  if (!id || detail.value) return
  loading.value = true
  try {
    const frozen = props.candidate.execution_input?.prepared.facts.find((f) => f.summary.id === id)
    const value: EndpointDetail = frozen
      ? { facts: frozen, knowledge: null }
      : await endpoint(props.candidate.project_id, id, current.signal)
    if (!current.signal.aborted) {
      cached.set(id, value)
      detail.value = value
    }
  } catch (cause) {
    if (!current.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '暂时无法读取结构'
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
})
onScopeDispose(() => request?.abort())
function choose(id: string) {
  target.value = { kind: 'endpoint', id }
}
const environment = computed(
  () => detail.value?.facts.summary.environments[0]?.environment_id ?? '',
)
</script>
<template>
  <div class="candidate-document">
    <nav aria-label="整理结果导航" class="candidate-tree-navigation">
      <slot name="navigation" />
      <slot name="tree">
        <CandidateTree
          :index="projected"
          :selected="target"
          :query="query"
          :changes="changes"
          @select="target = $event"
        />
      </slot>
    </nav>
    <slot name="content">
      <section class="candidate-endpoint" data-scroll-container>
        <p v-if="indexLoading && !index" class="curation-placeholder" role="status">
          正在读取接口索引…
        </p>
        <p v-else-if="indexError" class="curation-placeholder" role="alert">{{ indexError }}</p>
        <CandidateFolderOverview
          v-else-if="folder"
          :folder="folder"
          :path="path"
          :candidate="candidate"
          :change="folderChange"
          @select="target = $event"
        />
        <p v-else-if="!selected" class="curation-placeholder">
          选择左侧目录或接口，查看最终候选文档。
        </p>
        <template v-else>
          <header>
            <span class="curation-unapplied-label">{{
              candidate.state === 'applied' ? '本轮保存结果' : '候选知识 · 尚未应用'
            }}</span>
            <LifecycleNotice :target="{ kind: 'endpoint', id: selected }" />
            <h2
              :class="{
                'lifecycle-retired-name': !!lifecycle.get({ kind: 'endpoint', id: selected }),
              }"
            >
              {{ note?.name || entries.find((e) => e.interface_id === selected)?.path }}
            </h2>
            <code
              >{{ detail?.facts.summary.method }} {{ detail?.facts.summary.path_template }}</code
            >
            <p>{{ note?.purpose }}</p>
            <p v-if="note?.context?.description">{{ note.context.description }}</p>
          </header>
          <p v-if="loading" class="curation-placeholder">正在读取真实字段结构…</p>
          <p v-else-if="error" role="alert">{{ error }}</p>
          <section v-for="group in groups" :key="group.label" class="document-field-group">
            <h3>
              {{ group.label }} <small>{{ group.fields.length }}</small>
            </h3>
            <FieldStructure
              :fields="group.fields"
              :notes="notes"
              :environment-id="environment"
              :endpoint-id="selected"
              :entries="entries"
              @related="choose"
              @example="showExample"
            />
          </section>
        </template>
      </section>
    </slot>
  </div>
</template>

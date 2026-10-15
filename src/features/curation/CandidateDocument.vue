<script setup lang="ts">
import { provideLifecycle } from '@/features/documents/lifecycle/context'
import LifecycleNotice from '@/features/documents/lifecycle/LifecycleNotice.vue'
import { computed, onScopeDispose, shallowRef, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { documentLocation } from '@/features/documents/documentRoutes'
import FieldStructure from '@/features/documents/FieldStructure.vue'
import FieldEvidencePanel from '@/features/documents/FieldEvidencePanel.vue'
import { groupFields } from '@/features/knowledge/fieldPresentation'
import { reviewEndpoint } from './source'
import type { EndpointDetail, FieldNote } from '@/contracts/knowledge/types'
import type { Candidate, CandidateEndpointPage } from './types'
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
const endpointPage = shallowRef<CandidateEndpointPage | null>(null)
const fieldPage = ref(0)
let request: AbortController | undefined
const projected = computed(() => candidateIndex(props.candidate, props.index))
const entries = computed(() => projected.value.entries)
const tree = computed(() => documentTree(projected.value, null))
// Directory/placement bodies are already small and complete in the head.
const directoryChanges = computed(() =>
  candidateChanges(props.candidate).filter(
    (c) => c.section === 'folders' || c.section === 'placements',
  ),
)
const changes = computed(() => [...directoryChanges.value, ...(props.changes ?? [])])
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
    endpointPage.value = null
    detail.value = null
  },
)
watch(
  tree,
  (value) => {
    if (!target.value && value.length) target.value = { kind: 'folder', id: value[0]!.id }
  },
  { immediate: true },
)
const note = computed(
  () =>
    endpointPage.value?.note ??
    props.candidate.view.notes.find((n) => n.endpoint === selected.value),
)
const notes = computed(() => {
  const saved = endpointPage.value?.notes ?? []
  const inputs = endpointPage.value?.inputs ?? []
  const byKey = new Map(saved.map((n) => [n.path, n]))
  for (const field of inputs) {
    const old = byKey.get(field.key)
    byKey.set(field.key, {
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
    } as FieldNote)
  }
  return [...byKey.values()]
})
const groups = computed(() => groupFields(detail.value?.facts.fields ?? []))
const moreFields = computed(
  () =>
    (fieldPage.value + 1) * 100 <
    Math.max(endpointPage.value?.fields_total ?? 0, endpointPage.value?.notes_total ?? 0),
)
async function readEndpoint(append = false) {
  request?.abort()
  request = new AbortController()
  const current = request,
    id = selected.value,
    candidate = props.candidate
  const owns = () =>
    !current.signal.aborted &&
    selected.value === id &&
    props.candidate.id === candidate.id &&
    props.candidate.project_id === candidate.project_id &&
    props.candidate.version === candidate.version
  error.value = ''
  if (!append) {
    detail.value = null
    endpointPage.value = null
    fieldPage.value = 0
  }
  if (!id || candidate.version === undefined) return
  loading.value = true
  try {
    const page = await reviewEndpoint(
      candidate.project_id,
      candidate.id,
      candidate.version,
      id,
      (append ? fieldPage.value + 1 : 0) * 100,
      current.signal,
    )
    if (!owns()) return
    if (append && endpointPage.value) {
      fieldPage.value++
      page.notes = [...endpointPage.value.notes, ...page.notes]
      page.inputs = [...endpointPage.value.inputs, ...page.inputs]
      if (page.facts && detail.value)
        page.facts.fields = [...detail.value.facts.fields, ...page.facts.fields]
    }
    endpointPage.value = page
    detail.value = page.facts ? { facts: page.facts, knowledge: null } : null
  } catch (cause) {
    if (owns()) error.value = cause instanceof Error ? cause.message : '暂时无法读取历史结构'
  } finally {
    if (owns()) loading.value = false
  }
}
watch(
  [selected, () => props.candidate.id, () => props.candidate.version],
  () => void readEndpoint(),
)
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
          <p v-if="loading" class="curation-placeholder">正在读取本轮历史字段结构…</p>
          <p v-else-if="error" role="alert">{{ error }}</p>
          <template v-if="endpointPage && !endpointPage.facts_available">
            <p role="status">本轮冻结结构已释放或未保存；以下为保留的候选字段知识。</p>
            <details v-for="field in notes" :key="field.path">
              <summary>{{ field.context?.display_name || field.path }}</summary>
              <FieldEvidencePanel
                :path="field.context?.field_path || field.path"
                :note="field"
                :evidence="field.context?.evidence ?? []"
                :endpoint-id="selected"
                :environment-id="environment"
                :entries="entries"
                @related="choose"
                @example="showExample"
              />
            </details>
          </template>
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
          <button
            v-if="moreFields"
            type="button"
            class="curation-load-more"
            :disabled="loading"
            @click="readEndpoint(true)"
          >
            继续读取字段
          </button>
        </template>
      </section>
    </slot>
  </div>
</template>

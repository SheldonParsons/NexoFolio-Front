<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import DocumentPager from '@/features/documents/DocumentPager.vue'
import JsonDisclosure from '@/features/documents/JsonDisclosure.vue'
import EvidenceLinks from './EvidenceLinks.vue'
import { evidenceRefs } from './mapping'
import { phaseLabel } from './presentation'
import { maintenanceSource } from './source'
import { ApiError } from '@/api/client'
import type { MaintenanceCheckpointPage } from '@/contracts/maintenance/2.0.0/types.generated'
import type { EvidenceRef } from './models'
const props = defineProps<{ projectId: string; runId: string }>()
const emit = defineEmits<{ evidence: [ref: EvidenceRef]; unauthorized: [] }>()
const page = shallowRef<MaintenanceCheckpointPage | null>(null)
const busy = ref(false)
const error = ref('')
const pages = computed(() => Math.max(1, Math.ceil((page.value?.total ?? 0) / 20)))
let request: AbortController | undefined
async function load(number = 1) {
  request?.abort()
  const current = new AbortController()
  request = current
  busy.value = true
  error.value = ''
  try {
    const value = await maintenanceSource.checkpoints(
      props.projectId,
      props.runId,
      number,
      current.signal,
    )
    if (!current.signal.aborted && current === request) page.value = value
  } catch (cause) {
    if (!current.signal.aborted && current === request) {
      error.value = cause instanceof Error ? cause.message : '检查点读取失败。'
      if (cause instanceof ApiError && cause.status === 401) emit('unauthorized')
    }
  } finally {
    if (!current.signal.aborted && current === request) busy.value = false
  }
}
watch(
  () => [props.projectId, props.runId],
  () => {
    page.value = null
    void load()
  },
  { immediate: true },
)
onScopeDispose(() => request?.abort())
</script>
<template>
  <section class="maintenance-panel" aria-label="真实检查点与分片审阅">
    <header>
      <h2>检查点 / 分片审阅</h2>
      <button
        type="button"
        class="maintenance-action"
        :disabled="busy"
        @click="load(page?.page ?? 1)"
      >
        刷新检查点
      </button>
    </header>
    <p v-if="busy" role="status">读取检查点中…</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!busy && !error && !page?.items.length">尚无已保存检查点。</p>
    <article
      v-for="checkpoint in page?.items"
      :key="`${runId}:${checkpoint.id}`"
      class="maintenance-change"
    >
      <h3>
        {{ phaseLabel(checkpoint.phase) }} · <code>{{ checkpoint.id }}</code>
      </h3>
      <p v-if="checkpoint.summary != null">{{ checkpoint.summary }}</p>
      <p v-else class="maintenance-caption">此检查点未提供摘要正文。</p>
      <EvidenceLinks
        :evidence="evidenceRefs(projectId, checkpoint.references, runId)"
        @open="emit('evidence', $event)"
      />
      <section v-if="checkpoint.review">
        <h4>分片 {{ checkpoint.review.segment_id }}</h4>
        <p>{{ checkpoint.review.summary }}</p>
        <div class="maintenance-table-scroll">
          <table>
            <thead>
              <tr>
                <th>审阅单元 / 字段</th>
                <th>结论</th>
                <th>说明与证据</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(assessment, index) in checkpoint.review.assessments"
                :key="`${assessment.unit_id}:${assessment.field_id}:${index}`"
              >
                <td>
                  <code>{{ assessment.unit_id }}</code
                  ><button
                    type="button"
                    class="maintenance-action"
                    @click="
                      emit('evidence', {
                        id: assessment.field_id,
                        projectId,
                        runId,
                        kind: 'text',
                        resource: 'field',
                        label: assessment.field_id,
                      })
                    "
                  >
                    {{ assessment.field_id }}
                  </button>
                </td>
                <td>{{ assessment.disposition }}</td>
                <td>
                  <p>{{ assessment.note }}</p>
                  <EvidenceLinks
                    :evidence="evidenceRefs(projectId, assessment.evidence, runId)"
                    @open="emit('evidence', $event)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <JsonDisclosure :value="checkpoint.data" label="查看检查点原始数据" />
    </article>
    <DocumentPager
      v-if="page"
      :page="page.page"
      :pages="pages"
      :total="page.total"
      :loading="busy"
      label="检查点分页"
      @change="load"
    />
  </section>
</template>

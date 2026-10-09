<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { FieldNote, FieldEvidence, FieldFacts } from '@/contracts/knowledge/types'
import { formatTime } from './presentation'
import { splitFieldDetails, fieldStructureLines } from './fieldDetails'
import './field-evidence.css'
import FieldObservedValues from './FieldObservedValues.vue'
const props = defineProps<{
  path: string
  note: FieldNote
  evidence: FieldEvidence[]
  endpointId: string
  environmentId?: string
  field?: FieldFacts
  fields?: FieldFacts[]
  entries: Array<{ interface_id: string; name: string | null; path: string }>
}>()
const emit = defineEmits<{ related: [id: string]; example: [id: string] }>()
const details = computed(() => splitFieldDetails(props.note))
const structure = computed(() => fieldStructureLines(props.field, props.fields ?? [], props.note))
const observations = computed(() => props.evidence.filter((e) => e.kind === 'observation'))
const sources = computed(() =>
  props.evidence.filter((e) => e.kind === 'direct_source' || e.kind === 'related_interface'),
)
const unknowns = computed(() => [...new Set(props.note.context?.meaning?.unknowns ?? [])])
const technicalOpen = ref(false)
function sourceName(e: FieldEvidence) {
  return (
    props.entries.find((entry) => entry.interface_id === e.endpoint)?.name ||
    (e.endpoint === props.endpointId ? '当前接口' : '关联接口')
  )
}
</script>
<template>
  <article class="field-knowledge-panel">
    <header class="field-knowledge-heading">
      <div>
        <span class="field-knowledge-kicker">字段知识</span
        ><strong>{{ note.context?.display_name || path }}</strong
        ><span class="field-confirmation-chip">{{
          { candidate: '基础推断', observed: '观测对应', direct: '直接来源', confirmed: '已确认' }[
            note.context?.meaning?.confirmation ?? 'candidate'
          ]
        }}</span>
      </div>
      <time v-if="note.at" :datetime="note.at">知识更新 {{ formatTime(note.at) }}</time>
    </header>
    <div class="field-knowledge-grid">
      <section class="field-meaning-card">
        <h4>含义与补充</h4>
        <p class="field-main-meaning">
          {{
            note.text ||
            (note.context?.completion?.description.state === 'uncertain'
              ? '含义待确认'
              : '说明待补齐')
          }}
        </p>
        <p v-if="note.context?.completion?.name.state === 'missing'" class="field-unknowns">
          名称待补齐
        </p>
        <span v-if="note.context?.meaning?.unit" class="field-unit-chip"
          >单位 {{ note.context.meaning.unit }}</span
        >
        <ul v-if="details.business.length">
          <li v-for="detail in details.business" :key="detail">{{ detail }}</li>
        </ul>
        <div v-if="unknowns.length" class="field-unknowns">
          <h5><AppIcon name="circle-help" :size="13" />待确认</h5>
          <ul>
            <li v-for="unknown in unknowns" :key="unknown">{{ unknown }}</li>
          </ul>
        </div>
      </section>
      <section class="field-observation-card">
        <h4>真实观测 <small>不代表完整枚举或业务约束</small></h4>
        <FieldObservedValues
          v-if="note.context?.observations?.archive_id"
          :summary="note.context.observations"
          :field-key="note.path"
          :endpoint-id="endpointId"
          :environment-id="environmentId"
          @example="emit('example', $event)"
        />
        <div v-else-if="observations.length" class="field-observation-list">
          <div v-for="(basis, i) in observations" :key="i">
            <div class="field-evidence-options">
              <span v-for="option in basis.options" :key="option.value"
                ><code>{{ option.value }}</code
                ><span v-if="option.label">{{ option.label }}</span></span
              >
            </div>
            <button
              v-if="basis.example"
              type="button"
              class="field-source-link"
              @click="
                basis.endpoint === endpointId
                  ? emit('example', basis.example)
                  : emit('related', basis.endpoint)
              "
            >
              查看来源样本<AppIcon name="arrow-up-right" :size="12" />
            </button>
          </div>
        </div>
        <p v-else class="field-evidence-empty">当前范围尚无可展示的观测值。</p>
      </section>
      <section v-if="sources.length" class="field-source-cards">
        <h4>来源与关联线索</h4>
        <div class="field-source-grid">
          <article v-for="(basis, i) in sources" :key="i">
            <header>
              <span>{{ basis.kind === 'direct_source' ? '直接来源' : '候选关联' }}</span
              ><strong>{{ sourceName(basis) }}</strong>
            </header>
            <p>{{ basis.text }}</p>
            <div v-if="basis.options.length" class="field-evidence-options">
              <span v-for="option in basis.options" :key="option.value"
                ><code>{{ option.value }}</code
                ><span v-if="option.label">{{ option.label }}</span></span
              >
            </div>
            <footer>
              <span v-if="basis.source?.page" :title="basis.source.page">页面上下文已保留</span
              ><button
                v-if="basis.endpoint !== endpointId"
                type="button"
                class="field-source-link"
                @click="emit('related', basis.endpoint)"
              >
                打开关联接口<AppIcon name="arrow-up-right" :size="12" /></button
              ><button
                v-else-if="basis.example"
                type="button"
                class="field-source-link"
                @click="emit('example', basis.example)"
              >
                查看来源样本<AppIcon name="arrow-up-right" :size="12" />
              </button>
            </footer>
          </article>
        </div>
      </section>
    </div>
    <div class="field-technical-heading">
      <button type="button" :aria-expanded="technicalOpen" @click="technicalOpen = !technicalOpen">
        <AppIcon
          name="chevron-right"
          :size="12"
          :class="{ 'is-open': technicalOpen }"
        />结构与证据定位</button
      ><code :title="path">{{ path }}</code>
    </div>
    <div
      class="field-technical-reveal"
      :class="{ 'is-open': technicalOpen }"
      :inert="!technicalOpen"
      :aria-hidden="!technicalOpen"
    >
      <div>
        <dl v-if="structure.length">
          <div v-for="line in structure" :key="line[0]">
            <dt>{{ line[0] }}</dt>
            <dd>{{ line[1] }}</dd>
          </div>
        </dl>
        <p v-for="detail in details.technical" :key="detail">{{ detail }}</p>
        <p v-for="(basis, i) in evidence" :key="i">
          <span>{{ basis.kind === 'inference' ? '推断依据' : '证据定位' }}</span>
          {{
            basis.kind === 'inference'
              ? basis.text
              : [
                  basis.source?.location?.in,
                  basis.source?.pointer,
                  basis.source?.sequence != null ? '顺序 ' + basis.source.sequence : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || basis.field
          }}
        </p>
      </div>
    </div>
  </article>
</template>

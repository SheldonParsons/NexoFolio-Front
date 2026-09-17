<script setup lang="ts">
import EvidenceLinks from './EvidenceLinks.vue'
import { basisLabels, revisionState, sampleText } from './presentation'
import type { EvidenceRef, SemanticDocument } from './models'
import './maintenance.css'
defineProps<{ document: SemanticDocument }>()
const emit = defineEmits<{ evidence: [ref: EvidenceRef] }>()
</script>
<template>
  <section class="maintenance-panel" aria-label="接口语义资料">
    <header>
      <h2>语义资料</h2>
      <p class="maintenance-caption">
        语义补充独立于观测结构。已见取值不等于完整枚举，null 与未传分别展示。
      </p>
    </header>
    <p v-if="!document.fields.length">当前环境暂无语义资料。</p>
    <details
      v-for="field in document.fields"
      :key="`${document.environmentId}:${field.id}`"
      class="maintenance-field"
    >
      <summary>
        <code>{{ field.path }}</code
        ><span v-if="field.basis" class="maintenance-badge">{{ basisLabels[field.basis] }}</span
        ><span v-if="revisionState(field) === 'stale'" class="maintenance-badge"
          >stale · 字段修订已变化</span
        ><span v-else-if="revisionState(field) === 'unknown'" class="maintenance-badge"
          >修订尚未核对</span
        >
      </summary>
      <p v-if="revisionState(field) !== 'current'" class="maintenance-note">
        以下资料保留供复核，不能视为当前字段已确认的语义。
      </p>
      <p v-if="field.note">{{ field.note }}</p>
      <section>
        <h3>字段描述</h3>
        <template v-if="field.description"
          ><span class="maintenance-badge">{{ basisLabels[field.description.basis] }}</span>
          <p>{{ field.description.value }}</p>
          <EvidenceLinks :evidence="field.description.evidence" @open="emit('evidence', $event)"
        /></template>
        <p v-else class="maintenance-caption">尚未提供描述。</p>
      </section>
      <section>
        <h3>参数来源关系</h3>
        <p v-if="!field.sources.length" class="maintenance-caption">尚未提供来源关系。</p>
        <div v-for="(source, index) in field.sources" :key="index" class="maintenance-relation">
          <code>{{ source.fieldPath }}</code
          ><span class="maintenance-badge">{{ basisLabels[source.relation.basis] }}</span>
          <p>{{ source.relation.value }}</p>
          <EvidenceLinks :evidence="source.relation.evidence" @open="emit('evidence', $event)" />
        </div>
      </section>
      <section>
        <h3>
          {{
            field.enumeration.scope === 'complete'
              ? '完整枚举声明'
              : field.enumeration.scope === 'observed-only'
                ? '已见取值'
                : '枚举范围尚未确认'
          }}
        </h3>
        <p>{{ field.enumeration.scopeDescription || '未提供观察范围说明。' }}</p>
        <EvidenceLinks :evidence="field.enumeration.evidence" @open="emit('evidence', $event)" />
        <p v-if="field.enumeration.scope !== 'complete'" class="maintenance-caption">
          未出现的取值仍可能有效，不据此排除其他取值。
        </p>
        <div class="maintenance-table-scroll">
          <table v-if="field.enumeration.values.length">
            <thead>
              <tr>
                <th>取值 / 是否传入</th>
                <th>标签与依据</th>
                <th>观测次数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in field.enumeration.values" :key="index">
                <td>
                  <pre>{{ sampleText(entry.sample) }}</pre>
                </td>
                <td>
                  <template v-if="entry.label"
                    ><span class="maintenance-badge">{{ basisLabels[entry.label.basis] }}</span>
                    <p>{{ entry.label.value }}</p>
                    <EvidenceLinks
                      :evidence="entry.label.evidence"
                      @open="emit('evidence', $event)" /></template
                  ><span v-else>未提供标签</span
                  ><EvidenceLinks :evidence="entry.evidence" @open="emit('evidence', $event)" />
                </td>
                <td>{{ entry.count ?? '未知' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </details>
  </section>
</template>

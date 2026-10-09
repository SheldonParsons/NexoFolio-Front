<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import type { FieldFacts, FieldNote, FieldEvidence } from '@/contracts/knowledge/types'
import { compactFieldTree, type FieldNode } from './fieldTree'
import { typeList } from '@/features/knowledge/fieldPresentation'
import FieldEvidencePanel from './FieldEvidencePanel.vue'

const props = defineProps<{
  fields: FieldFacts[]
  notes: FieldNote[]
  environmentId: string
  endpointId: string
  entries: Array<{ interface_id: string; name: string | null; path: string }>
}>()
const emit = defineEmits<{ related: [id: string]; example: [id: string] }>()
const collapsed = ref(new Set<string>())
const expanded = ref(new Set<string>())
watch(
  () => props.endpointId,
  () => {
    collapsed.value = new Set()
    expanded.value = new Set()
  },
)
const rows = computed(() => {
  const result: Array<{ node: FieldNode; depth: number }> = []
  const visit = (nodes: FieldNode[], depth: number) => {
    for (const node of nodes) {
      result.push({ node, depth })
      if (!collapsed.value.has(node.key)) visit(node.children, depth + 1)
    }
  }
  visit(compactFieldTree(props.fields, props.notes), 0)
  return result
})
function toggle(set: Set<string>, key: string) {
  if (set.has(key)) set.delete(key)
  else set.add(key)
}
function displayedType(node: FieldNode): string {
  return node.item
    ? node.field.types.map((type) => (type === 'array' ? 'array<object>' : type)).join(' | ')
    : typeList(node.field.types)
}
function evidence(node: FieldNode, includeItem = true): FieldEvidence[] {
  return [node.note, ...(includeItem ? [node.item?.note] : [])]
    .flatMap((note) => note?.context?.evidence ?? [])
    .filter((e) => !e.environment || e.environment === props.environmentId)
}
function values(node: FieldNode): string[] {
  if (!node.note?.context?.evidence.length) return node.note?.values ?? []
  return [
    ...new Set(
      evidence(node)
        .filter((e) => e.kind === 'observation')
        .flatMap((e) => e.options.map((o) => o.value)),
    ),
  ]
}
function status(node: FieldNode): string {
  const label = node.field.labels.find((label) => label.environment_id === props.environmentId)
    ?.label.label
  return (
    (
      {
        optional: '部分调用出现',
        added: '新增',
        removed: '已移除',
        polymorphic: '多种类型',
      } as Record<string, string>
    )[label ?? ''] ?? ''
  )
}
</script>

<template>
  <div class="field-structure">
    <table>
      <colgroup>
        <col class="field-column" />
        <col class="type-column" />
        <col class="meaning-column" />
        <col class="value-column" />
      </colgroup>
      <thead>
        <tr>
          <th>字段</th>
          <th>类型</th>
          <th>说明 <span>基础含义为推断</span></th>
          <th>观测值 <span>非完整枚举</span></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="{ node, depth } in rows" :key="node.key">
          <tr
            :class="{
              'field-container': node.children.length,
              'field-has-evidence': expanded.has(node.key),
            }"
          >
            <td class="field-identity" :style="{ '--field-depth': depth }">
              <div>
                <button
                  v-if="node.children.length"
                  type="button"
                  class="field-fold"
                  :aria-expanded="!collapsed.has(node.key)"
                  :aria-label="(collapsed.has(node.key) ? '展开 ' : '收起 ') + node.name"
                  @click="toggle(collapsed, node.key)"
                >
                  <AppIcon
                    name="chevron-down"
                    :size="13"
                    :class="{ closed: collapsed.has(node.key) }"
                  />
                </button>
                <span v-else class="field-leaf" aria-hidden="true"></span>
                <code :title="node.path">{{ node.name }}</code>
                <span v-if="node.note?.context?.display_name" class="field-display-name">{{
                  node.note.context.display_name
                }}</span>
                <span
                  v-else-if="node.note?.context?.completion?.name.state === 'uncertain'"
                  class="field-unwritten"
                  >名称待确认</span
                >
                <span
                  v-else-if="node.note?.context?.completion?.name.state === 'missing'"
                  class="field-unwritten"
                  >名称待补齐</span
                >
                <small v-if="status(node)" class="field-status" :title="status(node)">·</small>
              </div>
            </td>
            <td class="field-type">{{ displayedType(node) }}</td>
            <td>
              <button
                v-if="node.note || node.item?.note"
                type="button"
                class="field-meaning"
                :aria-expanded="expanded.has(node.key)"
                @click="toggle(expanded, node.key)"
              >
                <span>{{
                  (node.note || node.item?.note)?.text ||
                  ((node.note || node.item?.note)?.context?.completion?.description.state ===
                  'uncertain'
                    ? '含义待确认'
                    : '说明待补齐')
                }}</span>
                <small
                  v-if="evidence(node).some((e) => e.kind === 'related_interface')"
                  title="其他接口提供的候选线索，业务关系尚未确认"
                  >线索</small
                >
                <AppIcon
                  name="chevron-down"
                  :size="11"
                  :class="{ closed: !expanded.has(node.key) }"
                />
              </button>
              <span v-else class="field-unwritten">待整理</span>
            </td>
            <td>
              <div v-if="node.note?.context?.observations?.archive_id" class="field-values">
                <button type="button" class="field-more-values" @click="toggle(expanded, node.key)">
                  查看观测值
                </button>
              </div>
              <div v-else class="field-values">
                <code v-for="value in values(node).slice(0, 1)" :key="value" :title="value">{{
                  value
                }}</code>
                <button
                  v-if="values(node).length > 1"
                  type="button"
                  class="field-more-values"
                  :aria-label="'查看 ' + node.name + ' 的 ' + values(node).length + ' 个观测值'"
                  @click="toggle(expanded, node.key)"
                >
                  +{{ values(node).length - 1 }}
                </button>
                <span v-if="!values(node).length" class="field-unwritten">—</span>
              </div>
            </td>
          </tr>
          <tr
            v-if="expanded.has(node.key) && (node.note || node.item?.note)"
            class="field-evidence-row"
          >
            <td colspan="4">
              <FieldEvidencePanel
                v-if="node.note"
                :path="node.path"
                :note="node.note"
                :evidence="evidence(node, false)"
                :endpoint-id="endpointId"
                :environment-id="environmentId"
                :entries="entries"
                :field="node.field"
                :fields="fields"
                @related="emit('related', $event)"
                @example="emit('example', $event)"
              />
              <p v-if="node.item?.note" class="field-element-meaning">
                元素：{{ node.item.note.text }}
              </p>
              <FieldEvidencePanel
                v-if="node.item?.note"
                :path="node.item.path"
                :note="node.item.note"
                :evidence="evidence(node.item, false)"
                :endpoint-id="endpointId"
                :environment-id="environmentId"
                :entries="entries"
                :field="node.item.field"
                :fields="fields"
                @related="emit('related', $event)"
                @example="emit('example', $event)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped src="./field-structure.css"></style>

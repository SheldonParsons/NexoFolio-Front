<script setup lang="ts">
import { useLifecycle } from '../lifecycle/context'
import { hiddenRetirement } from '../lifecycle/model'
import LifecycleNotice from '../lifecycle/LifecycleNotice.vue'
const lifecycle = useLifecycle()
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { fieldTree, type FieldNode } from '../fieldTree'
import { typeList } from '@/features/knowledge/fieldPresentation'
import type { PublicField } from './source'
const props = defineProps<{ fields: PublicField[]; endpointId: string }>()
const closed = ref(new Set<string>())
watch(
  () => props.endpointId,
  () => {
    closed.value = new Set()
  },
)
const notes = computed(() => new Map(props.fields.map((field) => [field.key, field])))
const rows = computed(() => {
  const result: Array<{ node: FieldNode; depth: number }> = []
  function visit(nodes: FieldNode[], depth: number) {
    for (const node of nodes) {
      result.push({ node, depth })
      if (!closed.value.has(node.key)) visit(node.children, depth + 1)
    }
  }
  const fields =
    lifecycle &&
    !lifecycle.showRetired.value &&
    !lifecycle.get({ kind: 'endpoint', id: props.endpointId })
      ? props.fields.filter(
          (f) =>
            !hiddenRetirement(lifecycle.state.value, {
              kind: 'field',
              endpoint: props.endpointId,
              location: f.structure.location,
              path: f.structure.path,
            }),
        )
      : props.fields
  visit(
    fieldTree(
      fields.map((f) => f.structure),
      [],
    ),
    0,
  )
  return result
})
function toggle(key: string) {
  if (closed.value.has(key)) closed.value.delete(key)
  else closed.value.add(key)
}
</script>
<template>
  <div class="field-structure">
    <table>
      <colgroup>
        <col class="field-column" />
        <col class="type-column" />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>字段</th>
          <th>类型</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="{ node, depth } in rows" :key="node.key">
          <td class="field-identity" :style="{ '--field-depth': depth }">
            <div>
              <button
                v-if="node.children.length"
                class="field-fold"
                type="button"
                :aria-expanded="!closed.has(node.key)"
                :aria-label="(closed.has(node.key) ? '展开 ' : '收起 ') + node.name"
                @click="toggle(node.key)"
              >
                <AppIcon name="chevron-down" :size="13" :class="{ closed: closed.has(node.key) }" />
              </button>
              <span v-else class="field-leaf" aria-hidden="true"></span>
              <code
                :class="{
                  'lifecycle-retired-name': !!lifecycle?.get({
                    kind: 'field',
                    endpoint: endpointId,
                    location: node.field.location,
                    path: node.field.path,
                  }),
                }"
                :title="node.path"
                >{{ node.name }}</code
              ><span
                v-if="notes.get(node.key)?.name"
                class="field-display-name"
                :class="{
                  'lifecycle-retired-name': !!lifecycle?.get({
                    kind: 'field',
                    endpoint: endpointId,
                    location: node.field.location,
                    path: node.field.path,
                  }),
                }"
                >{{ notes.get(node.key)?.name }}</span
              >
            </div>
          </td>
          <td class="field-type">{{ typeList(node.field.types) }}</td>
          <td>
            <p v-if="notes.get(node.key)?.retired_sources">
              关联来源已废弃；当前字段仍按自身状态判断。
            </p>
            <LifecycleNotice
              :target="{
                kind: 'field',
                endpoint: endpointId,
                location: node.field.location,
                path: node.field.path,
              }"
            />
            <p>{{ notes.get(node.key)?.description || '说明尚未补充' }}</p>
            <details
              v-if="notes.get(node.key)?.details.length || notes.get(node.key)?.unknowns.length"
            >
              <summary>补充说明与尚未验证的事项</summary>
              <p v-for="text in notes.get(node.key)?.details" :key="text">{{ text }}</p>
              <p v-for="text in notes.get(node.key)?.unknowns" :key="text">
                尚未验证的事项：{{ text }}
              </p>
            </details>
            <small
              v-if="
                notes.get(node.key)?.confirmation &&
                notes.get(node.key)?.confirmation !== 'confirmed'
              "
              class="field-unwritten"
              >业务含义待确认</small
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped src="../field-structure.css"></style>

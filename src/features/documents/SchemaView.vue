<script setup lang="ts">
import { computed } from 'vue'
import JsonDisclosure from './JsonDisclosure.vue'
import { schemaRows } from './schemaPresentation'
const props = defineProps<{ schema: Record<string, unknown> }>()
const view = computed(() => schemaRows(props.schema))
</script>
<template>
  <div class="schema-view">
    <table class="document-field-table">
      <thead>
        <tr>
          <th scope="col">字段 / 结构</th>
          <th scope="col">观测类型</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in view.rows" :key="`${row.path}-${index}`">
          <td>
            <div :style="{ paddingLeft: `${Math.min(row.depth, 12) * 12}px` }">
              <code :title="row.path">{{ row.label }}</code
              ><small v-if="row.note">{{ row.note }}</small>
            </div>
          </td>
          <td>
            <code class="observed-type">{{ row.type }}</code>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="view.truncated" class="document-note">
      结构较大或层级较深，表格仅展示前 400 个节点／32 层。完整观测结构可在下方 JSON 查看。
    </p>
    <JsonDisclosure :value="schema" label="查看完整结构 JSON" />
  </div>
</template>

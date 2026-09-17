<script setup lang="ts">
import { computed } from 'vue'
import { schemaType } from './schemaPresentation'
const props = defineProps<{
  fields: { name: string; observed_schema: Record<string, unknown> }[]
  title: string
}>()
const visibleFields = computed(() => props.fields.slice(0, 400))
</script>
<template>
  <section class="document-field-section">
    <h4>
      {{ title }} <span>{{ fields.length }}</span>
    </h4>
    <table v-if="fields.length" class="document-field-table">
      <thead>
        <tr>
          <th scope="col">名称</th>
          <th scope="col">观测类型</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(field, index) in visibleFields" :key="`${field.name}-${index}`">
          <td>
            <code>{{ field.name }}</code>
          </td>
          <td>
            <code class="observed-type">{{ schemaType(field.observed_schema) }}</code>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="document-empty-inline">未记录到字段。</p>
    <p v-if="fields.length > 400" class="document-note">
      字段较多，表格展示前 400 项；完整字段见下方定义 JSON。
    </p>
  </section>
</template>

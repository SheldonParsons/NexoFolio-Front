<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationNamedRaw } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import './breadcrumbs.css'
const props = defineProps<{
  projectId: string
  name: string
  candidateId: string
  environmentId: string
}>()
type Crumb = { kind: string; label: string; to: RouteLocationNamedRaw; current?: boolean }
const crumbs = computed<Crumb[]>(() => {
  const query = props.environmentId ? { env: props.environmentId } : {}
  const params = { projectId: props.projectId }
  return [
    { kind: 'projects', label: '项目空间', to: { name: 'projects' } },
    { kind: 'project', label: props.name, to: { name: 'project-interfaces', params, query } },
    {
      kind: 'results',
      label: '整理结果',
      to: { name: 'curation-review', params, query },
      current: !props.candidateId,
    },
    ...(props.candidateId
      ? [
          {
            kind: 'round',
            label: '本轮结果',
            to: {
              name: 'curation-review',
              params: { ...params, candidateId: props.candidateId },
              query,
            },
            current: true,
          },
        ]
      : []),
  ]
})
</script>
<template>
  <h1 class="sr-only">{{ name }} · 整理结果{{ candidateId ? ' · 本轮结果' : '列表' }}</h1>
  <nav class="curation-breadcrumbs" aria-label="整理结果页面位置">
    <ol>
      <li v-for="(crumb, index) in crumbs" :key="crumb.kind">
        <AppIcon v-if="index" name="chevron-right" :size="11" mode="static" />
        <RouterLink
          :to="crumb.to"
          :data-kind="crumb.kind"
          :aria-current="crumb.current ? 'page' : undefined"
          >{{ crumb.label }}</RouterLink
        >
      </li>
    </ol>
  </nav>
</template>

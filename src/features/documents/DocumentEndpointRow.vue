<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useMarqueeOverflow } from '@/features/knowledge/useMarqueeOverflow'
import DocumentPreview from './DocumentPreview.vue'
import { documentLocation } from './documentRoutes'
import type { DocumentEntry } from './source'
const props = defineProps<{
  entry: DocumentEntry
  selected: boolean
  projectId: string
  environmentId: string
  context: string
  previewPlacement?: 'overview'
}>()
const label = computed(() => props.entry.name || props.entry.path)
const labelElement = ref<HTMLElement>()
const marquee = useMarqueeOverflow(labelElement, label, 20)
const to = computed(() =>
  documentLocation(
    props.projectId,
    { kind: 'endpoint', id: props.entry.interface_id },
    props.environmentId,
  ),
)
const usage = computed(() =>
  props.entry.summary.environments.find((e) => e.environment_id === props.environmentId),
)
</script>
<template>
  <DocumentPreview
    :placement="previewPlacement"
    :to="to"
    :name="label"
    :purpose="entry.purpose"
    :path="entry.path"
    :method="entry.method"
    :context="context"
    :meta="usage ? '当前环境调用 ' + usage.calls + ' 次' : '当前环境尚无观测'"
    v-slot="preview"
  >
    <RouterLink
      :to="to"
      class="interface-list-item"
      :class="{ 'is-selected': selected }"
      :aria-current="selected ? 'page' : undefined"
      :aria-label="entry.method + ' ' + label"
      :aria-describedby="preview.previewOpen ? preview.previewId : undefined"
      aria-keyshortcuts="ArrowRight"
      :data-endpoint-id="entry.interface_id"
    >
      <span class="http-method" :data-method="entry.method" aria-hidden="true">{{
        entry.method
      }}</span>
      <span class="interface-item-content"
        ><strong
          ref="labelElement"
          :class="{ 'is-overflowing': marquee.overflowing.value }"
          :style="marquee.style()"
          ><b class="document-tree-marquee-track"
            ><span data-marquee-text>{{ label }}</span
            ><span v-if="marquee.overflowing.value" aria-hidden="true">{{ label }}</span></b
          ></strong
        ></span
      >
      <AppIcon name="arrow-up-right" :size="13" />
    </RouterLink>
  </DocumentPreview>
</template>

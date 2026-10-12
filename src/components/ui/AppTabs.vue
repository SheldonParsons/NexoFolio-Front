<script setup lang="ts">
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
defineProps<{ label: string; options: { value: string; label: string }[] }>()
const model = defineModel<string>({ required: true })
</script>
<template>
  <TabsRoot :model-value="model" @update:model-value="model = String($event)" class="nf-tabs"
    ><TabsList :aria-label="label" class="nf-tabs-list"
      ><TabsTrigger
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        class="nf-tabs-trigger"
        >{{ option.label }}</TabsTrigger
      ></TabsList
    ><TabsContent
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="nf-tabs-panel"
      ><slot :name="option.value" /></TabsContent
  ></TabsRoot>
</template>
<style>
.nf-tabs-list {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 28px;
}
.nf-tabs-trigger {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--muted);
  padding: 12px 0;
  font-size: 14px;
}
.nf-tabs-trigger[data-state='active'] {
  border-color: var(--text);
  color: var(--text);
  font-weight: 550;
}
.nf-tabs-trigger:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
.nf-tabs-panel {
  min-width: 0;
  outline: none;
}
</style>

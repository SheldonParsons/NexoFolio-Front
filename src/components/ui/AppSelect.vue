<script setup lang="ts" generic="T extends string">
import { ref } from 'vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'

const props = defineProps<{
  label: string
  options: { value: T; label: string }[]
  disabled?: boolean
  placeholder?: string
}>()
const model = defineModel<T>({ required: true })
const open = ref(false)
function update(value: unknown) {
  if (typeof value === 'string' && props.options.some((option) => option.value === value))
    model.value = value as T
}
</script>

<template>
  <SelectRoot
    v-model:open="open"
    :model-value="model"
    :disabled="disabled"
    @update:model-value="update"
  >
    <SelectTrigger class="nf-select-trigger" :aria-label="label"
      ><SelectValue :placeholder="placeholder" /><span class="sr-only">{{ label }}</span
      ><SelectIcon as-child
        ><AppIcon
          class="nf-select-chevron"
          name="chevron-down"
          active-name="chevron-up"
          :active="open"
          :size="15" /></SelectIcon
    ></SelectTrigger>
    <SelectPortal
      ><SelectContent
        class="nf-select-content"
        position="popper"
        align="end"
        :side-offset="7"
        :collision-padding="12"
        ><SelectViewport class="nf-select-viewport"
          ><SelectItem
            v-for="option in options"
            :key="option.value"
            class="nf-select-item"
            :value="option.value"
            ><SelectItemText class="nf-select-item-text">{{ option.label }}</SelectItemText
            ><span class="nf-select-check-slot"
              ><SelectItemIndicator class="nf-select-check"
                ><AppIcon
                  name="check"
                  :size="
                    14
                  " /></SelectItemIndicator></span></SelectItem></SelectViewport></SelectContent
    ></SelectPortal>
  </SelectRoot>
</template>

<!-- Namespaced global styles: portal/fragment descendants do not reliably inherit SFC scope IDs. -->
<style src="./app-select.css"></style>

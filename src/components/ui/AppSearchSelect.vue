<script setup lang="ts">
import { ref } from 'vue'
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxItemIndicator,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'
import AppButton from './AppButton.vue'
import './app-select.css'
import './app-search-select.css'
const props = defineProps<{
  label: string
  options: { value: string; label: string }[]
  selectedLabel?: string
  placeholder?: string
  loading?: boolean
  error?: string
  emptyMessage?: string
  hint?: string
  disabled?: boolean
}>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ search: [query: string]; retry: [] }>()
const open = ref(false),
  keyboard = ref(true)
function display(value: unknown) {
  return props.options.find((option) => option.value === value)?.label || props.selectedLabel || ''
}
function opened(value: boolean) {
  open.value = value
  if (value) emit('search', '')
}
function input(event: Event) {
  if (event instanceof InputEvent && event.isComposing) return
  emit('search', (event.target as HTMLInputElement).value)
}
function selected(value: unknown) {
  if (typeof value === 'string') model.value = value
}
</script>
<template>
  <ComboboxRoot
    :model-value="model"
    :open="open"
    :disabled="disabled"
    ignore-filter
    open-on-click
    @update:open="opened"
    @update:model-value="selected"
    ><ComboboxAnchor
      class="nf-select-trigger nf-search-select-trigger"
      :data-state="open ? 'open' : 'closed'"
      :data-keyboard-focus="keyboard"
      @pointerdown="keyboard = false"
      @keydown="keyboard = true"
      ><ComboboxInput
        class="nf-search-select-input"
        :display-value="display"
        :aria-label="label"
        :placeholder="placeholder || '搜索并选择'"
        autocomplete="off"
        @input="input"
        @compositionend="input"
        @blur="keyboard = true" /><ComboboxTrigger
        class="nf-search-select-arrow"
        :aria-label="`展开${label}`"
        tabindex="-1"
        ><AppIcon
          :name="open ? 'chevron-up' : 'chevron-down'"
          :size="15" /></ComboboxTrigger></ComboboxAnchor
    ><ComboboxPortal
      ><ComboboxContent
        class="nf-select-content nf-search-select-content"
        position="popper"
        align="start"
        :side-offset="7"
        :collision-padding="12"
        ><ComboboxViewport class="nf-select-viewport"
          ><div v-if="loading" class="nf-search-select-feedback" role="status">
            <span class="nf-search-select-spinner" aria-hidden="true"></span>正在查找…
          </div>
          <div
            v-else-if="error"
            class="nf-search-select-feedback nf-search-select-error"
            role="alert"
          >
            <span>{{ error }}</span
            ><AppButton variant="ghost" @click="emit('retry')">重试</AppButton>
          </div>
          <template v-else
            ><ComboboxItem
              v-for="option in options"
              :key="option.value"
              :value="option.value"
              class="nf-select-item nf-search-select-item"
              ><span class="nf-select-item-text">{{ option.label }}</span
              ><span class="nf-select-check-slot"
                ><ComboboxItemIndicator class="nf-select-check"
                  ><AppIcon name="check" :size="14" /></ComboboxItemIndicator></span
            ></ComboboxItem>
            <p v-if="!options.length" class="nf-search-select-feedback" role="status">
              {{ emptyMessage || '没有匹配选项' }}
            </p>
            <p v-if="hint" class="nf-search-select-hint">{{ hint }}</p></template
          ></ComboboxViewport
        ></ComboboxContent
      ></ComboboxPortal
    ></ComboboxRoot
  >
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'
defineProps<{ label: string; disabled?: boolean; size?: 'default' | 'compact' }>()
const checked = defineModel<boolean>({ required: true })
const id = useId()
</script>
<template>
  <div class="nf-checkbox-field" :class="{ 'is-compact': size === 'compact' }">
    <CheckboxRoot
      :id="id"
      :model-value="checked"
      :disabled="disabled"
      class="nf-checkbox"
      @update:model-value="checked = $event === true"
      ><CheckboxIndicator force-mount class="nf-checkbox-indicator">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 8.25 6.75 11.5 12.5 5.25" pathLength="1" />
        </svg> </CheckboxIndicator></CheckboxRoot
    ><label :for="id">{{ label }}</label>
  </div>
</template>
<style>
.nf-checkbox-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.nf-checkbox {
  width: 17px;
  height: 17px;
  flex: none;
  border: 1px solid var(--muted);
  border-radius: 4px;
  background: var(--surface);
  color: var(--bg);
  display: grid;
  place-items: center;
  padding: 0;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.nf-checkbox[data-state='checked'] {
  background: var(--text);
  border-color: var(--text);
}
.nf-checkbox:not(:disabled):hover {
  border-color: var(--text);
}
.nf-checkbox:not(:disabled):active {
  transform: scale(0.92);
}
.nf-checkbox-indicator {
  display: grid;
  place-items: center;
}
.nf-checkbox-indicator svg {
  width: 14px;
  height: 14px;
}
.nf-checkbox-indicator path {
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  transition:
    stroke-dashoffset 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 100ms ease;
}
.nf-checkbox[data-state='checked'] .nf-checkbox-indicator path {
  stroke-dashoffset: 0;
  opacity: 1;
}
.nf-checkbox:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}
.nf-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nf-checkbox-field label {
  cursor: pointer;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.7;
  flex: 1;
}
.nf-checkbox-field.is-compact {
  gap: 6px;
  min-height: 24px;
}
.nf-checkbox-field.is-compact .nf-checkbox {
  width: 14px;
  height: 14px;
}
.nf-checkbox-field.is-compact .nf-checkbox-indicator svg {
  width: 12px;
  height: 12px;
}
.nf-checkbox-field.is-compact label {
  font-size: 11px;
}
.nf-checkbox-field:has(.nf-checkbox:disabled) label {
  cursor: not-allowed;
}
@media (prefers-reduced-motion: reduce) {
  .nf-checkbox,
  .nf-checkbox-indicator path {
    transition: none;
  }
}
</style>

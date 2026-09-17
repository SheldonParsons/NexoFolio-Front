<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { useIconInteraction } from '@/components/motion/useIconInteraction'
const iconMotion = useIconInteraction()
const clearMotion = useIconInteraction()
defineProps<{ modelValue: string; busy: boolean; disabled: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  clear: []
  compositionStart: []
  compositionEnd: [value: string]
}>()
const input = ref<HTMLInputElement>()
function clear() {
  emit('clear')
  input.value?.focus()
}
function onKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  }
  if (event.key === 'Escape' && input.value?.value) {
    event.preventDefault()
    clear()
  }
}
</script>
<template>
  <div class="project-search" :class="{ 'is-disabled': disabled }" v-on="iconMotion.events">
    <AppIcon
      name="search"
      active-name="scan-search"
      :active="iconMotion.active.value && !disabled"
      :size="18"
    />
    <input
      ref="input"
      :value="modelValue"
      type="search"
      autocomplete="off"
      spellcheck="false"
      :disabled="disabled"
      aria-label="搜索全部项目"
      :placeholder="disabled ? '全项目搜索尚未上线' : '搜索项目…'"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="onKey"
      @compositionstart="emit('compositionStart')"
      @compositionend="emit('compositionEnd', ($event.target as HTMLInputElement).value)"
    />
    <span class="project-search-suffix">
      <span v-if="busy" class="project-progress" role="status" aria-label="正在搜索"
        ><i></i><i></i><i></i
      ></span>
      <Transition name="search-clear"
        ><button
          v-if="modelValue && !busy"
          type="button"
          aria-label="清除搜索"
          v-on="clearMotion.events"
          @pointerdown.prevent
          @click="clear"
        >
          <AppIcon
            name="x"
            active-name="circle-x"
            :active="clearMotion.active.value"
            :size="16"
          /></button
      ></Transition>
    </span>
  </div>
</template>

<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui'
import AppIcon from '@/components/icons/AppIcon.vue'

defineProps<{ title: string; description: string }>()
const emit = defineEmits<{ openAutoFocus: [event: Event] }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content t-modal"
        @open-auto-focus="emit('openAutoFocus', $event)"
      >
        <div class="dialog-heading">
          <div>
            <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
            <DialogDescription class="dialog-description">{{ description }}</DialogDescription>
          </div>
          <DialogClose class="icon-button" aria-label="关闭弹窗"
            ><AppIcon name="x" :size="18"
          /></DialogClose>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

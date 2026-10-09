<script setup lang="ts">
import { watch } from 'vue'
import {
  AlertDialogRoot,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from 'reka-ui'
import AppButton from './AppButton.vue'
import '@/components/motion/modal.css'
import './app-confirm-dialog.css'
defineProps<{
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  disabled?: boolean
  error?: string
}>()
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })
let returnFocus: HTMLElement | null = null
watch(
  open,
  (value) => {
    if (value && typeof document !== 'undefined')
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  },
  { flush: 'sync' },
)
function restoreFocus(event: Event) {
  event.preventDefault()
  const target =
    returnFocus?.isConnected && !returnFocus.matches(':disabled')
      ? returnFocus
      : document.getElementById('main-content')
  target?.focus({ preventScroll: true })
}
</script>
<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="dialog-overlay confirm-overlay" />
      <AlertDialogContent
        class="dialog-content confirm-dialog t-modal"
        @escape-key-down="pending && $event.preventDefault()"
        @close-auto-focus="restoreFocus"
      >
        <header class="confirm-heading">
          <AlertDialogTitle class="dialog-title">{{ title }}</AlertDialogTitle>
          <AlertDialogDescription class="dialog-description">{{
            description
          }}</AlertDialogDescription>
        </header>
        <slot />
        <p v-if="error" class="confirm-error" role="alert">{{ error }}</p>
        <footer class="confirm-actions">
          <AlertDialogCancel as-child
            ><AppButton :disabled="pending">取消</AppButton></AlertDialogCancel
          >
          <AppButton variant="primary" :disabled="pending || disabled" @click="emit('confirm')">{{
            pending ? '处理中…' : confirmLabel
          }}</AppButton>
        </footer>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

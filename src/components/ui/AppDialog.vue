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

const props = withDefaults(
  defineProps<{
    title: string
    description: string
    tone?: 'dark'
    placement?: 'right'
    dismissible?: boolean
  }>(),
  { dismissible: true },
)
const emit = defineEmits<{ openAutoFocus: [event: Event]; closeAutoFocus: [event: Event] }>()
const open = defineModel<boolean>('open', { default: false })
function updateOpen(value: boolean) {
  if (value || props.dismissible !== false) open.value = value
}
function preventDismiss(event: Event) {
  if (props.dismissible === false) event.preventDefault()
}
</script>

<template>
  <DialogRoot :open="open" @update:open="updateOpen">
    <DialogTrigger v-if="$slots.trigger" as-child><slot name="trigger" /></DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content t-modal"
        :class="{
          'dialog-content--dark': tone === 'dark',
          'dialog-content--drawer': placement === 'right',
        }"
        @open-auto-focus="emit('openAutoFocus', $event)"
        @close-auto-focus="emit('closeAutoFocus', $event)"
        @escape-key-down="preventDismiss"
        @pointer-down-outside="preventDismiss"
        @interact-outside="preventDismiss"
      >
        <div class="dialog-heading">
          <div>
            <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
            <DialogDescription class="dialog-description">{{ description }}</DialogDescription>
          </div>
          <DialogClose class="icon-button" aria-label="关闭弹窗" :disabled="dismissible === false"
            ><AppIcon name="x" :size="18"
          /></DialogClose>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.dialog-content.dialog-content--drawer {
  inset: 0 0 0 auto;
  width: min(520px, 100vw);
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0;
  border-radius: 0;
  padding: 32px 28px max(28px, env(safe-area-inset-bottom));
  overflow-y: auto;
  transform: none;
  transform-origin: right center;
}
@media (max-width: 540px) {
  .dialog-content.dialog-content--drawer {
    padding: 24px 20px;
  }
}

.dialog-content--dark {
  --surface: #0d0d0d;
  --surface-muted: #1b1b1b;
  --text: #efefef;
  --muted: #a1a1a1;
  --border: #303030;
  --focus: #ddd;
  color-scheme: dark;
}
</style>

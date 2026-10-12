<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { PopoverRoot, PopoverAnchor, PopoverPortal, PopoverContent } from 'reka-ui'
import { useDocumentPreview } from './useDocumentPreview'
const props = defineProps<{
  to: RouteLocationRaw
  name: string
  purpose?: string | null
  path?: string
  method?: string
  context: string
  meta?: string
  placement?: 'overview'
}>()
const preview = useDocumentPreview(),
  token = Symbol('preview')
const open = computed(() => preview.active.value === token)
const id = useId(),
  host = ref<HTMLElement>(),
  copied = ref(''),
  keyboardHint = ref(false),
  pointerX = ref<number | null>(null)
// A whole-width row has no usable lateral space. Anchor the card beside the
// mouse column instead; downward browsing never passes through the panel.
const reference = computed(() => {
  if (!host.value) return undefined
  if (props.placement !== 'overview') {
    // Directory labels exclude the trailing action slot. Anchor outside the
    // whole row so a preview cannot cover its more-actions control.
    const row = host.value.closest<HTMLElement>('.document-folder-heading')
    return row
      ? { contextElement: row, getBoundingClientRect: () => row.getBoundingClientRect() }
      : undefined
  }
  const element = host.value
  const x = pointerX.value
  return {
    contextElement: element,
    getBoundingClientRect: () => {
      const rect = element.getBoundingClientRect()
      return new DOMRect(x ?? rect.left + Math.min(200, rect.width / 3), rect.top, 0, rect.height)
    },
  }
})
const panelStyle = computed(() => {
  if (props.placement !== 'overview' || !host.value) return undefined
  const rect = host.value.getBoundingClientRect()
  const x = pointerX.value ?? rect.left + Math.min(200, rect.width / 3)
  return { width: `${Math.min(380, Math.max(x - 22, window.innerWidth - x - 22))}px` }
})
function trackPointer(event: PointerEvent) {
  if (
    props.placement === 'overview' &&
    event.pointerType !== 'touch' &&
    (!open.value || event.type === 'pointerenter')
  )
    pointerX.value = event.clientX
}
function enter(event: PointerEvent) {
  if (event.pointerType !== 'touch') {
    keyboardHint.value = false
    trackPointer(event)
    preview.enter(token)
  }
}
function focusIn(event: FocusEvent) {
  keyboardHint.value = (event.target as HTMLElement).matches(':focus-visible')
  if (keyboardHint.value) pointerX.value = null
  preview.enter(token)
}
function focusOut(event: FocusEvent) {
  const next = event.relatedTarget as HTMLElement | null
  if (next && (host.value?.contains(next) || document.getElementById(id)?.contains(next))) return
  preview.leave(token)
}
async function actions() {
  if (!props.path) return
  keyboardHint.value = true
  preview.keep(token)
  await nextTick()
  document.getElementById(id)?.querySelector<HTMLElement>('button')?.focus()
}
function escape() {
  const inCard = document.getElementById(id)?.contains(document.activeElement)
  preview.cancel(token)
  if (inCard) host.value?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true })
  // Focusing the trigger must not queue a new card after Escape.
  preview.close()
}
async function copyPath() {
  try {
    await navigator.clipboard.writeText(props.path ?? '')
    copied.value = '已复制接口路径'
  } catch {
    copied.value = '复制失败，可选中接口路径复制'
  }
}
watch(
  () => props.to,
  () => {
    preview.cancel(token)
  },
)
watch(open, () => {
  copied.value = ''
})
onScopeDispose(() => {
  preview.cancel(token)
})
</script>
<template>
  <PopoverRoot :open="open" :modal="false" @update:open="!$event && preview.close()">
    <span
      ref="host"
      class="document-preview-host"
      @pointerenter="enter"
      @pointermove="trackPointer"
      @pointerleave="preview.leave(token)"
      @focusin="focusIn"
      @focusout="focusOut"
      @keydown.esc.stop.prevent="escape"
      @keydown.right.stop.prevent="actions"
    >
      <PopoverAnchor as-child :reference="reference">
        <slot :preview-id="id" :preview-open="open" />
      </PopoverAnchor>
    </span>
    <PopoverPortal>
      <PopoverContent
        class="document-preview"
        side="right"
        :style="panelStyle"
        :prioritize-position="placement === 'overview'"
        :align-flip="placement !== 'overview'"
        :avoid-collisions="true"
        :align="placement === 'overview' ? 'end' : 'start'"
        :side-offset="10"
        :collision-padding="12"
        :hide-when-detached="true"
        aria-label="文档预览"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @focus-outside.prevent
        @escape-key-down.prevent="escape"
        @pointerenter="preview.keep(token)"
        @pointerleave="preview.leave(token)"
        @focusin="preview.keep(token)"
        @focusout="focusOut"
      >
        <div :id="id">
          <p class="document-preview-context">{{ context }}</p>
          <div class="document-preview-title">
            <span v-if="method" class="http-method" :data-method="method">{{ method }}</span
            ><strong>{{ name }}</strong>
          </div>
          <p class="document-preview-purpose">
            {{ purpose || '用途说明尚未补充，可点击列表名称查看已保存的观测。' }}
          </p>
          <code v-if="path" class="document-preview-path">{{ path }}</code>
          <button v-if="path" type="button" class="document-preview-copy-path" @click="copyPath">
            复制路径
          </button>
          <p v-if="meta" class="document-preview-meta">{{ meta }}</p>
          <p v-if="copied" class="document-preview-meta" role="status">{{ copied }}</p>
          <p v-if="keyboardHint" class="document-preview-hint">
            {{
              path
                ? '键盘操作：按 → 选中“复制路径”，按 Esc 关闭预览。'
                : '键盘操作：按 Esc 关闭预览。'
            }}
          </p>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

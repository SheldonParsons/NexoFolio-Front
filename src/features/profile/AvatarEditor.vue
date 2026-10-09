<script setup lang="ts">
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import {
  openAvatar,
  drawCrop,
  cropDataURL,
  cropRectangle,
  panCrop,
  zoomCrop,
  type AvatarCrop,
  type CropPosition,
} from './avatarCrop'
import AppIcon from '@/components/icons/AppIcon.vue'
import './avatar-editor.css'
const props = defineProps<{ saving: boolean }>()
const emit = defineEmits<{ save: [url: string]; cancel: [] }>()
const fileInput = ref<HTMLInputElement>(),
  canvas = ref<HTMLCanvasElement>(),
  cropWindow = ref<HTMLElement>()
const crop = shallowRef<AvatarCrop | null>(null)
const position = ref<CropPosition>({ zoom: 1, x: 0.5, y: 0.5 })
const error = ref(''),
  reading = ref(false),
  encoding = ref(false),
  previewReady = ref(false)
const drag = shallowRef<{ id: number; x: number; y: number; size: number } | null>(null)
const blocked = computed(() => props.saving || reading.value || encoding.value)
const contextStyle = computed(() => {
  if (!crop.value) return {}
  const { side, left, top } = cropRectangle(crop.value, position.value)
  return {
    width: (crop.value.width / side) * 100 + '%',
    height: (crop.value.height / side) * 100 + '%',
    left: (-left / side) * 100 + '%',
    top: (-top / side) * 100 + '%',
  }
})
let sequence = 0
async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || blocked.value) return
  const id = ++sequence
  reading.value = true
  error.value = ''
  finishDrag()
  try {
    const value = await openAvatar(file)
    if (id !== sequence) {
      URL.revokeObjectURL(value.url)
      return
    }
    if (crop.value) URL.revokeObjectURL(crop.value.url)
    previewReady.value = false
    crop.value = value
    position.value = { zoom: 1, x: 0.5, y: 0.5 }
  } catch (cause) {
    if (id === sequence) error.value = cause instanceof Error ? cause.message : '图片读取失败'
  } finally {
    if (id === sequence) reading.value = false
  }
}
function redraw() {
  if (!canvas.value || !crop.value) return
  try {
    drawCrop(canvas.value, crop.value, position.value)
    previewReady.value = true
  } catch (cause) {
    previewReady.value = false
    error.value = cause instanceof Error ? cause.message : '预览生成失败'
  }
}
watch([crop, position], redraw, { flush: 'post' })
function setZoom(zoom: number) {
  if (blocked.value || !crop.value || !Number.isFinite(zoom)) return
  finishDrag()
  position.value = zoomCrop(crop.value, position.value, zoom)
}
function startDrag(event: PointerEvent) {
  if (blocked.value || !crop.value || drag.value || event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  drag.value = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    size: element.getBoundingClientRect().width,
  }
  element.focus({ preventScroll: true })
  element.setPointerCapture(event.pointerId)
  event.preventDefault()
}
function moveDrag(event: PointerEvent) {
  const active = drag.value
  if (!active || active.id !== event.pointerId || !crop.value || blocked.value) return
  position.value = panCrop(
    crop.value,
    position.value,
    event.clientX - active.x,
    event.clientY - active.y,
    active.size,
  )
  active.x = event.clientX
  active.y = event.clientY
}
function finishDrag(event?: PointerEvent) {
  const active = drag.value
  if (!active || (event && active.id !== event.pointerId)) return
  drag.value = null
  if (cropWindow.value?.hasPointerCapture(active.id))
    cropWindow.value.releasePointerCapture(active.id)
}
function moveByKey(event: KeyboardEvent) {
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }
  const direction = directions[event.key]
  if (!direction || blocked.value || !crop.value || !cropWindow.value) return
  event.preventDefault()
  const step = event.shiftKey ? 16 : 4
  position.value = panCrop(
    crop.value,
    position.value,
    direction[0] * step,
    direction[1] * step,
    cropWindow.value.getBoundingClientRect().width,
  )
}
watch(blocked, (value) => {
  if (value) finishDrag()
})
async function save() {
  if (!canvas.value || !previewReady.value || blocked.value) return
  const id = sequence
  encoding.value = true
  error.value = ''
  try {
    const url = await cropDataURL(canvas.value)
    if (id === sequence) emit('save', url)
  } catch (cause) {
    if (id === sequence) error.value = cause instanceof Error ? cause.message : '头像生成失败'
  } finally {
    if (id === sequence) encoding.value = false
  }
}
onScopeDispose(() => {
  sequence++
  finishDrag()
  if (crop.value) URL.revokeObjectURL(crop.value.url)
})
</script>
<template>
  <section class="avatar-editor">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="profile-file-input"
      aria-label="选择头像图片"
      :disabled="blocked"
      @change="choose"
    />
    <div class="avatar-crop-stage" :class="{ 'is-dragging': !!drag }">
      <template v-if="crop">
        <div class="avatar-crop-context" aria-hidden="true">
          <img :src="crop.url" :style="contextStyle" alt="" draggable="false" />
        </div>
        <div
          ref="cropWindow"
          class="avatar-crop-window"
          role="group"
          :aria-disabled="blocked"
          :tabindex="blocked ? -1 : 0"
          aria-label="头像裁剪区域，拖动图片或使用方向键调整位置"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="finishDrag"
          @pointercancel="finishDrag"
          @lostpointercapture="finishDrag"
          @keydown="moveByKey"
        >
          <canvas ref="canvas" aria-label="头像裁剪预览"></canvas>
        </div>
      </template>
      <button
        v-else
        type="button"
        class="avatar-pick-button"
        :disabled="blocked"
        @click="fileInput?.click()"
      >
        <AppIcon name="layers" :size="28" /><strong>{{
          reading ? '读取图片中…' : '选择图片'
        }}</strong
        ><span>JPG、PNG 或 WebP · 最多 20 MiB</span>
      </button>
    </div>
    <div v-if="crop" class="avatar-zoom-control">
      <button
        type="button"
        aria-label="缩小图片"
        :disabled="blocked || position.zoom <= 1"
        @click="setZoom(position.zoom - 0.1)"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
      <input
        type="range"
        min="1"
        max="4"
        step=".01"
        :value="position.zoom"
        :disabled="blocked"
        aria-label="缩放图片"
        :aria-valuetext="Math.round(position.zoom * 100) + '%'"
        @input="setZoom(Number(($event.target as HTMLInputElement).value))"
      />
      <button
        type="button"
        aria-label="放大图片"
        :disabled="blocked || position.zoom >= 4"
        @click="setZoom(position.zoom + 0.1)"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5v14" />
        </svg>
      </button>
    </div>
    <p v-if="error" class="profile-error" role="alert">{{ error }}</p>
    <footer class="profile-actions avatar-editor-actions">
      <button
        type="button"
        class="profile-secondary"
        :disabled="saving || encoding"
        @click="emit('cancel')"
      >
        取消</button
      ><button
        type="button"
        class="profile-primary"
        :disabled="blocked || !previewReady"
        @click="save"
      >
        {{ saving || encoding ? '保存中…' : '保存' }}
      </button>
    </footer>
  </section>
</template>

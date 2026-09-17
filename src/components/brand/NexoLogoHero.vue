<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { loadElasticModule, type ElasticAnimation } from './elastic'

const host = ref<HTMLDivElement | null>(null)
const status = ref<'loading' | 'ready' | 'fallback'>('loading')
const poster = `${import.meta.env.BASE_URL}nexofolio/static-logo.png`
let animation: ElasticAnimation | undefined
let disposed = false
let generation = 0
let timeout: ReturnType<typeof setTimeout> | undefined

function cleanup() {
  generation++
  clearTimeout(timeout)
  host.value?.querySelector('canvas')?.removeEventListener('webglcontextlost', fallback)
  animation?.destroy()
  animation = undefined
  host.value?.replaceChildren()
}

function fallback() {
  cleanup()
  if (!disposed) status.value = 'fallback'
}

async function mount() {
  cleanup()
  const current = generation
  status.value = 'loading'
  timeout = setTimeout(fallback, 15_000)
  try {
    const module = await loadElasticModule()
    if (disposed || current !== generation || !host.value) return
    animation = module.mountNexoElastic(host.value, {
      autoPlay: true,
      maxPixelRatio: 2,
      introDuration: 2,
      viewRollDegrees: -8,
    })
    const canvas = host.value.querySelector('canvas')
    // Preserve vertical page scrolling on touch devices; pointercancel restores the mesh.
    if (canvas) {
      canvas.style.touchAction = 'pan-y pinch-zoom'
      canvas.addEventListener('webglcontextlost', fallback)
    }
    const result = await animation.ready
    if (disposed || current !== generation) return
    if (!result.ok) {
      fallback()
      return
    }
    clearTimeout(timeout)
    status.value = 'ready'
  } catch {
    if (!disposed && current === generation) fallback()
  }
}

function pageHide() {
  cleanup()
}
function pageShow(event: PageTransitionEvent) {
  if (event.persisted && !disposed) void mount()
}
onMounted(() => {
  window.addEventListener('pagehide', pageHide)
  window.addEventListener('pageshow', pageShow)
  void mount()
})
onBeforeUnmount(() => {
  disposed = true
  cleanup()
  window.removeEventListener('pagehide', pageHide)
  window.removeEventListener('pageshow', pageShow)
})

// Local integration inspection without adding a production window global or UI controls.
defineExpose({ getAnimation: () => (import.meta.env.DEV ? animation : undefined) })
</script>

<template>
  <div class="logo-hero" :data-state="status">
    <img
      v-if="status === 'fallback'"
      class="logo-poster"
      :src="poster"
      alt="NexoFolio 黑色立体标志"
      width="2364"
      height="1216"
    />
    <div
      ref="host"
      class="logo-canvas-host"
      :class="{ 'is-ready': status === 'ready' }"
      :aria-hidden="status !== 'ready'"
    />
  </div>
</template>

<style scoped>
.logo-hero {
  position: relative;
  width: 100%;
  height: 460px;
  background: transparent;
  isolation: isolate;
}
.logo-canvas-host {
  width: 100%;
  height: 100%;
  opacity: 0;
}
.logo-canvas-host.is-ready {
  opacity: 1;
}
.logo-canvas-host :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  outline: none;
}
.logo-canvas-host :deep(canvas:focus-visible) {
  outline: 1px solid #888;
  outline-offset: -3px;
}
.logo-poster {
  transform: rotate(8deg);
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}
@media (max-width: 900px) {
  .logo-hero {
    height: 350px;
  }
}
@media (max-width: 650px) {
  .logo-hero {
    height: 260px;
    max-width: 460px;
    margin-inline: auto;
  }
}
</style>

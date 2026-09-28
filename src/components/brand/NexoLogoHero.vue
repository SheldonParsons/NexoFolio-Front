<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { LogoFilm } from './film/logo-scene.js'

const host = ref<HTMLDivElement | null>(null)
const caption = ref<HTMLDivElement | null>(null)
const status = ref<'loading' | 'ready' | 'fallback'>('loading')
const poster = `${import.meta.env.BASE_URL}nexofolio/static-logo.png`
let animation: LogoFilm | undefined
let disposed = false
let generation = 0
let timeout: ReturnType<typeof setTimeout> | undefined

function cleanup() {
  generation++
  clearTimeout(timeout)
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
  if (caption.value) caption.value.style.opacity = '0'
  timeout = setTimeout(fallback, 15_000)
  try {
    const { createLogoScene, CAPTION_AT } = await import('./film/logo-scene.js')
    if (disposed || current !== generation || !host.value) return
    animation = createLogoScene(host.value, {
      onFrame(time) {
        if (disposed || current !== generation || !caption.value) return
        const reveal = Math.max(0, Math.min(1, (time - CAPTION_AT) / 0.3))
        caption.value.style.opacity = String(reveal)
        caption.value.style.transform = `translateY(${(1 - reveal) * 8}px)`
      },
      onPlay() {},
      onReady() {
        if (disposed || current !== generation) return
        clearTimeout(timeout)
        status.value = 'ready'
      },
      onError() {
        // WebGL construction can fail synchronously before the handle is assigned.
        queueMicrotask(() => {
          if (!disposed && current === generation) fallback()
        })
      },
    })
  } catch {
    if (!disposed && current === generation) fallback()
  }
}
function pageHide() { cleanup() }
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
</script>

<template>
  <div class="logo-hero" :data-state="status">
    <img v-if="status === 'fallback'" class="logo-poster" :src="poster" alt="NexoFolio 标志" width="2364" height="1216" />
    <div ref="host" class="logo-canvas-host" :class="{ 'is-ready': status === 'ready' }" :aria-hidden="status !== 'ready'" />
    <div v-show="status === 'ready'" ref="caption" class="film-caption" aria-hidden="true">KNOWLEDGE, CONNECTED.</div>
  </div>
</template>

<style scoped>
.logo-hero { position: relative; width: 100%; height: 460px; background: transparent; }
/* The renderer composites transparent glow; no rectangular CSS mask is needed. */
.logo-canvas-host { position: relative; width: 100%; height: 100%; opacity: 0; pointer-events: none; }
.logo-canvas-host.is-ready { opacity: 1; }
.logo-canvas-host :deep(canvas) { position: absolute; left: -40%; top: -40%; display: block; width: 180%; height: 180%; pointer-events: none; }
.logo-poster { transform: rotate(8deg); position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.film-caption { position: absolute; top: 67%; left: 0; right: 0; opacity: 0; text-align: center; font: 9px 'SFMono-Regular', Consolas, monospace; letter-spacing: 2.4px; color: #8f928f; pointer-events: none; }
@media (max-width: 900px) { .logo-hero { height: 350px; } }
@media (max-width: 650px) {
  .logo-hero { height: 260px; max-width: 460px; margin-inline: auto; }
  .film-caption { top: 66%; font-size: 7px; letter-spacing: 1.6px; }
}
</style>

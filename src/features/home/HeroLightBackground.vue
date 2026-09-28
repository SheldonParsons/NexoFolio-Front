<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const canvas = ref<HTMLCanvasElement | null>(null)
let context: CanvasRenderingContext2D | null = null
let sizeObserver: ResizeObserver | undefined
let visibilityObserver: IntersectionObserver | undefined
let preference: MediaQueryList | undefined
let area: HTMLElement | null = null
let width = 0, height = 0, ratio = 1
let time = 0, lastFrame = 0, frame = 0
let visible = false, reduced = false, disposed = false
let pointerX = 0, pointerY = 0, driftX = 0, driftY = 0

function draw() {
  const ctx = context
  if (!ctx || !width || !height) return
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const mobile = width < 650
  const cx = width * (mobile ? 0.55 : 0.76)
  const cy = height * (mobile ? 0.24 : 0.5)
  ctx.save()
  ctx.translate(cx + driftX * 8, cy + driftY * 6)
  ctx.rotate(-0.55 + Math.sin(time * 0.11) * 0.22)
  ctx.globalCompositeOperation = 'screen'
  for (let index = 0; index < 3; index++) {
    const spread = width * (0.075 + index * 0.025)
    const shift = Math.sin(time * 0.14 + index * 1.7) * width * 0.11 + index * width * 0.04
    ctx.save()
    ctx.translate(shift, 0)
    ctx.scale(spread, height * 0.85)
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
    glow.addColorStop(0, `rgba(180,186,198,${0.11 - index * 0.023})`)
    glow.addColorStop(0.25, `rgba(134,143,160,${0.065 - index * 0.012})`)
    glow.addColorStop(0.65, 'rgba(76,85,106,0.014)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(-1, -1, 2, 2)
    ctx.restore()
  }
  for (let index = 0; index < 22; index++) {
    const x = (index - 11) * width * 0.008 + Math.sin(time * 0.13) * width * 0.1
    ctx.beginPath()
    ctx.moveTo(x - width * 0.035, -height * 0.55)
    ctx.bezierCurveTo(x + width * 0.08, -height * 0.15, x - width * 0.06, height * 0.2, x + width * 0.04, height * 0.52)
    ctx.strokeStyle = `rgba(163,175,194,${0.009 * (1 - Math.abs(index - 11) / 12)})`
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}
function stop() {
  cancelAnimationFrame(frame)
  frame = 0
  lastFrame = 0
}
function tick(now: number) {
  frame = 0
  if (disposed || reduced || !visible || document.hidden) return
  if (!lastFrame || now - lastFrame >= 1000 / 30) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.08) : 0
    time += dt
    lastFrame = now
    driftX += (pointerX - driftX) * 0.06
    driftY += (pointerY - driftY) * 0.06
    draw()
  }
  frame = requestAnimationFrame(tick)
}
function wake() {
  if (!frame && !disposed && !reduced && visible && !document.hidden) frame = requestAnimationFrame(tick)
}
function resize() {
  if (!canvas.value || !context) return
  const bounds = canvas.value.getBoundingClientRect()
  width = bounds.width
  height = bounds.height
  ratio = Math.min(window.devicePixelRatio || 1, 1.5)
  canvas.value.width = Math.round(width * ratio)
  canvas.value.height = Math.round(height * ratio)
  draw()
}
function move(event: PointerEvent) {
  if (reduced || event.pointerType === 'touch' || !area) return
  const bounds = area.getBoundingClientRect()
  pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1
  pointerY = (event.clientY - bounds.top) / bounds.height * 2 - 1
}
function leave() { pointerX = 0; pointerY = 0 }
function visibility() { if (document.hidden) stop(); else wake() }
function changePreference() {
  reduced = preference?.matches ?? false
  if (reduced) { stop(); driftX = 0; driftY = 0; time = 0; draw() }
  else wake()
}
function pageShow() { resize(); wake() }
onMounted(() => {
  if (!canvas.value) return
  context = canvas.value.getContext('2d')
  if (!context) return
  area = canvas.value.parentElement
  preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced = preference.matches
  sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(canvas.value)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    if (visible) wake(); else stop()
  })
  if (area) visibilityObserver.observe(area)
  area?.addEventListener('pointermove', move, { passive: true })
  area?.addEventListener('pointerleave', leave)
  preference.addEventListener('change', changePreference)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', stop)
  window.addEventListener('pageshow', pageShow)
  resize()
})
onBeforeUnmount(() => {
  disposed = true
  stop()
  sizeObserver?.disconnect()
  visibilityObserver?.disconnect()
  area?.removeEventListener('pointermove', move)
  area?.removeEventListener('pointerleave', leave)
  preference?.removeEventListener('change', changePreference)
  document.removeEventListener('visibilitychange', visibility)
  window.removeEventListener('pagehide', stop)
  window.removeEventListener('pageshow', pageShow)
  context = null
})
</script>

<template><canvas ref="canvas" class="hero-light-background" aria-hidden="true" /></template>

<style scoped>
.hero-light-background { position: absolute; top: -94px; left: 50%; transform: translateX(-50%); width: 100vw; height: calc(100% + 154px); z-index: 0; pointer-events: none;
  /* Fade behind the copy and at the top/bottom edges. Static, so the
     compositor applies it instead of the canvas redrawing it every frame. */
  --fade-x: linear-gradient(to right, rgba(0,0,0,0.24), rgba(0,0,0,0.17) 36%, rgba(0,0,0,0.94) 59%, #000);
  --fade-y: linear-gradient(transparent, #000 18%, #000 72%, transparent);
  -webkit-mask: var(--fade-x), var(--fade-y);
  -webkit-mask-composite: source-in;
  mask: var(--fade-x), var(--fade-y);
  mask-composite: intersect; }
@media (max-width: 650px) { .hero-light-background { top: -79px; height: calc(100% + 109px); } }
</style>

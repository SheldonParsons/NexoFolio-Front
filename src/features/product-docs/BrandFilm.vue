<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { iconPaths, wordmarkPaths } from '@/features/auth/motion/nexofolioGeometry'

const source =
  'https://asynctest.oss-cn-shenzhen.aliyuncs.com/nexofolio/videos/nexofolio-brand-v6.mp4'
const video = ref<HTMLVideoElement>()
const ready = ref(false)
const started = ref(false)
const buffering = ref(false)
const pendingPlay = ref(false)
const ended = ref(false)
const slow = ref(false)
const error = ref('')
const seconds = ref(32)
const busy = computed(() => !error.value && (!ready.value || pendingPlay.value || buffering.value))
const duration = computed(
  () =>
    `${Math.floor(seconds.value / 60)
      .toString()
      .padStart(2, '0')}:${(seconds.value % 60).toString().padStart(2, '0')}`,
)
let timer: ReturnType<typeof setTimeout> | undefined
let attempt = 0
let disposed = false
function stopTimer() {
  clearTimeout(timer)
  slow.value = false
}
function watchLoading() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!ready.value && !disposed) slow.value = true
  }, 12000)
}
function canPlay() {
  ready.value = true
  buffering.value = false
  stopTimer()
}
function metadata() {
  if (video.value && Number.isFinite(video.value.duration))
    seconds.value = Math.round(video.value.duration)
}
function playing() {
  if (disposed) return
  canPlay()
  started.value = true
  pendingPlay.value = false
  ended.value = false
  error.value = ''
}
function waiting() {
  if (started.value && !video.value?.paused) buffering.value = true
}
function failed() {
  if (disposed) return
  attempt++
  stopTimer()
  video.value?.pause()
  pendingPlay.value = false
  buffering.value = false
  started.value = false
  error.value = '影片暂时未能加载'
}
async function play() {
  const media = video.value
  if (!media || pendingPlay.value) return
  const current = ++attempt
  error.value = ''
  pendingPlay.value = true
  media.muted = false
  if (media.ended || ended.value) media.currentTime = 0
  try {
    await media.play()
  } catch {
    if (disposed || current !== attempt) return
    pendingPlay.value = false
    buffering.value = false
    error.value = '播放未能开始，请重试'
  }
}
function retry() {
  attempt++
  error.value = ''
  ready.value = false
  started.value = false
  pendingPlay.value = false
  buffering.value = false
  ended.value = false
  watchLoading()
  video.value?.load()
}
function finish() {
  started.value = false
  buffering.value = false
  pendingPlay.value = false
  ended.value = true
  ready.value = true
}
onMounted(() => {
  watchLoading()
  if (video.value && video.value.readyState >= 3) canPlay()
})
onBeforeUnmount(() => {
  disposed = true
  attempt++
  clearTimeout(timer)
  if (video.value) {
    video.value.pause()
    video.value.removeAttribute('src')
    video.value.load()
  }
})
</script>

<template>
  <figure
    class="brand-film"
    :class="{ 'is-started': started, 'is-busy': busy, 'has-error': !!error }"
    aria-label="NexoFolio 品牌短片"
  >
    <video
      ref="video"
      :src="source"
      class="film-video"
      preload="auto"
      playsinline
      :controls="started"
      :tabindex="started ? 0 : -1"
      aria-label="NexoFolio 品牌短片，有声播放"
      @loadedmetadata="metadata"
      @canplay="canPlay"
      @playing="playing"
      @waiting="waiting"
      @pause="buffering = false"
      @ended="finish"
      @error="failed"
    />
    <div
      v-if="!started || buffering"
      class="film-cover"
      :class="{ 'film-cover--buffering': started }"
    >
      <div class="film-meta" aria-hidden="true">
        <span>{{ duration }}</span>
      </div>
      <div
        class="film-signature"
        :class="{ 'film-signature--loading': busy }"
        role="img"
        aria-label="NexoFolio"
      >
        <svg class="film-mark" viewBox="-35 -35 592 553" aria-hidden="true">
          <path
            v-for="(path, i) in iconPaths"
            :key="i"
            :d="path"
            :class="`film-mark-half-${i}`"
            fill="currentColor"
            fill-rule="evenodd"
          />
        </svg>
        <svg class="film-wordmark" viewBox="0 0 750 154" aria-hidden="true">
          <path
            v-for="(path, i) in wordmarkPaths"
            :key="i"
            :d="path"
            fill="currentColor"
            fill-rule="evenodd"
          />
        </svg>
      </div>
      <div v-if="busy" class="film-status" role="status" aria-live="polite">
        <span class="film-loading-track" aria-hidden="true" />
        <span>{{
          buffering
            ? '正在缓冲'
            : pendingPlay
              ? '正在开始播放'
              : slow
                ? '影片仍在加载'
                : '正在准备影片'
        }}</span>
        <button v-if="slow && !pendingPlay" class="film-text-button" type="button" @click="play">
          点击开始播放
        </button>
      </div>
      <div v-else-if="error" class="film-status film-status--error" role="alert">
        <span>{{ error }}</span>
        <button class="film-text-button" type="button" @click="retry">重新加载</button>
        <a :href="source" target="_blank" rel="noopener">在新窗口观看 ↗</a>
      </div>
      <button
        v-else
        class="film-play"
        type="button"
        :aria-label="
          ended ? '重新播放 NexoFolio 品牌短片，开启声音' : '播放 NexoFolio 品牌短片，开启声音'
        "
        @click="play"
      >
        <span class="film-play-disc" aria-hidden="true"
          ><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg
        ></span>
        <span>{{ ended ? '再看一次' : '播放影片' }}<small>开启声音</small></span>
      </button>
      <p v-if="!started" class="film-caption">让每次调用，成为知识。</p>
    </div>
  </figure>
</template>

<style scoped>
.brand-film {
  position: relative;
  isolation: isolate;
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 34px 0 40px;
  overflow: hidden;
  border-radius: 12px;
  background: #08090b;
  color: #f4f5f7;
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 7%) inset,
    0 12px 36px -24px rgb(0 0 0 / 40%);
  color-scheme: dark;
}
.film-video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  background: #08090b;
}
.is-started .film-video {
  opacity: 1;
}
.film-cover {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 38%, #171a20 0, #0b0d10 43%, #07080a 85%);
}
.film-cover::after {
  content: '';
  pointer-events: none;
  position: absolute;
  inset: 1px;
  border: 1px solid rgb(255 255 255 / 5%);
  border-radius: 11px;
}
.film-cover--buffering {
  bottom: 58px;
  pointer-events: none;
  background: rgb(7 8 10 / 80%);
}
.film-meta {
  position: absolute;
  inset: 27px 31px auto;
  display: flex;
  justify-content: flex-end;
  color: #949aa4;
  font-size: 11px;
  letter-spacing: 0.13em;
}
.film-meta span:last-child {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
}
.film-signature {
  position: absolute;
  top: 44%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 17px;
  width: 48%;
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
}
.film-mark {
  width: clamp(56px, 8vw, 105px);
  height: auto;
  overflow: visible;
  filter: drop-shadow(0 3px 20px rgb(255 255 255 / 5%));
}
.film-wordmark {
  width: min(100%, 250px);
  height: auto;
  opacity: 0.97;
  transition: opacity 350ms;
}
.film-signature--loading .film-wordmark {
  opacity: 0.48;
}
.film-signature--loading .film-mark-half-0 {
  animation: film-left 1800ms cubic-bezier(0.45, 0, 0.25, 1) infinite;
}
.film-signature--loading .film-mark-half-1 {
  animation: film-right 1800ms cubic-bezier(0.45, 0, 0.25, 1) infinite;
}
.film-caption {
  position: absolute;
  bottom: 25px;
  left: 0;
  right: 0;
  margin: 0;
  text-align: center;
  color: #a4a9b2;
  font-size: 12px;
  letter-spacing: 0.12em;
}
.film-play {
  position: absolute;
  top: 73%;
  left: 50%;
  transform: translate(-50%, calc(-50% + 9px));
  display: flex;
  align-items: center;
  gap: 13px;
  border: 0;
  padding: 8px 18px 8px 8px;
  border-radius: 40px;
  background: transparent;
  color: #f4f5f7;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  text-align: left;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 220ms,
    transform 350ms cubic-bezier(0.22, 1, 0.36, 1),
    background 220ms;
}
.film-play small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: #9fa5af;
}
.film-play-disc {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 24%);
  border-radius: 50%;
  background: rgb(255 255 255 / 7%);
  transition:
    background 220ms,
    color 220ms,
    border-color 220ms;
}
.film-play-disc svg {
  width: 20px;
  height: 20px;
  margin-left: 2px;
}
.brand-film:hover .film-play,
.brand-film:focus-within .film-play {
  opacity: 1;
  transform: translate(-50%, -50%);
}
.film-play:hover {
  background: rgb(255 255 255 / 4%);
}
.film-play:hover .film-play-disc,
.film-play:focus-visible .film-play-disc {
  background: #f4f5f7;
  color: #090b0e;
  border-color: #f4f5f7;
}
.film-play:focus-visible,
.film-text-button:focus-visible,
.film-status a:focus-visible {
  outline: 2px solid #f4f5f7;
  outline-offset: 5px;
}
.film-status {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 69%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #a4a9b2;
  font-size: 12px;
  letter-spacing: 0.035em;
}
.film-loading-track {
  width: 50px;
  height: 2px;
  overflow: hidden;
  background: rgb(255 255 255 / 10%);
}
.film-loading-track::after {
  content: '';
  display: block;
  width: 24px;
  height: 2px;
  background: #ee7a43;
  animation: film-travel 1800ms ease-in-out infinite;
}
.film-text-button,
.film-status a {
  padding: 4px 0;
  border: 0;
  border-bottom: 1px solid #646b76;
  background: transparent;
  color: #eef0f4;
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}
.film-status--error {
  top: 66%;
  gap: 8px;
}
.has-error .film-caption {
  display: none;
}
@keyframes film-left {
  0%,
  100% {
    transform: translate(0, 0);
    opacity: 1;
  }
  38% {
    transform: translate(-22px, 5px);
    opacity: 0.42;
  }
  72% {
    transform: translate(0, 0);
    opacity: 1;
  }
}
@keyframes film-right {
  0%,
  100% {
    transform: translate(0, 0);
    opacity: 1;
  }
  38% {
    transform: translate(22px, -5px);
    opacity: 0.42;
  }
  72% {
    transform: translate(0, 0);
    opacity: 1;
  }
}
@keyframes film-travel {
  0% {
    transform: translateX(-25px);
  }
  75%,
  100% {
    transform: translateX(51px);
  }
}
@media (hover: none), (pointer: coarse) {
  .film-play {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}
@media (max-width: 600px) {
  .brand-film {
    margin: 24px 0 30px;
  }
  .film-meta {
    inset: 15px 17px auto;
    font-size: 10px;
  }
  .film-signature {
    top: 43%;
    gap: 8px;
    width: 44%;
  }
  .film-mark {
    width: 53px;
  }
  .film-wordmark {
    width: 150px;
  }
  .film-play {
    top: 77%;
    padding: 4px 12px 4px 4px;
    gap: 9px;
    font-size: 12px;
  }
  .film-play-disc {
    width: 34px;
    height: 34px;
  }
  .film-play small,
  .film-caption {
    display: none;
  }
  .film-status {
    top: 72%;
    gap: 6px;
    font-size: 11px;
  }
  .film-status--error {
    top: 65%;
  }
  .has-error .film-signature {
    top: 34%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .brand-film *,
  .brand-film *::after {
    animation: none !important;
    transition: none !important;
  }
  .film-loading-track::after {
    transform: translateX(13px);
  }
}
</style>

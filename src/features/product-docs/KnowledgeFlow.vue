<script setup lang="ts">
const assetRoot = `${import.meta.env.BASE_URL}illustrations/`
const steps = [
  {
    title: '收集',
    image: 'knowledge-collection.png',
    alt: '雾蓝色纸面上，一只张开的手接住散落的资料片段。',
    connector: 'knowledge-ink-rise.png',
  },
  {
    title: '整理',
    image: 'knowledge-review.png',
    alt: '暖砂色纸面上，一只手将记录逐一整理对齐。',
    connector: 'knowledge-ink-fall.png',
  },
  {
    title: '积累',
    image: 'knowledge-accumulation.png',
    alt: '灰绿色纸面上，一只手将新的记录叠放在已有资料上。',
    connector: null,
  },
]
</script>

<template>
  <figure class="knowledge-flow" aria-label="收集、整理、积累">
    <div class="knowledge-flow-gallery">
      <div v-for="step in steps" :key="step.title" class="knowledge-flow-step">
        <div class="knowledge-flow-artwork">
          <img
            class="knowledge-flow-image"
            :src="assetRoot + step.image"
            :alt="step.alt"
            width="1254"
            height="1254"
            loading="lazy"
            decoding="async"
          />
          <img
            v-if="step.connector"
            class="knowledge-flow-ink"
            :src="assetRoot + step.connector"
            alt=""
            aria-hidden="true"
            width="1536"
            height="1024"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
        </div>
        <p class="knowledge-flow-label">{{ step.title }}</p>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.knowledge-flow {
  --flow-gap: clamp(20px, 6vw, 48px);
  margin: 32px 0 40px;
  color: var(--text);
}
.knowledge-flow-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--flow-gap);
}
.knowledge-flow-step {
  min-width: 0;
}
.knowledge-flow-artwork {
  position: relative;
}
.knowledge-flow-image {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 12px;
}
.knowledge-flow-ink {
  position: absolute;
  z-index: 1;
  left: 82%;
  top: 30%;
  width: calc(var(--flow-gap) + 36%);
  max-width: none;
  height: auto;
  pointer-events: none;
  user-select: none;
}
.knowledge-flow-step:nth-child(2) .knowledge-flow-ink {
  top: 38%;
}
.knowledge-flow-label {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
}
:root[data-theme='dark'] .knowledge-flow-ink {
  filter: invert(0.85);
}
@media (max-width: 600px) {
  .knowledge-flow {
    --flow-gap: 22px;
  }
  .knowledge-flow-image {
    border-radius: 8px;
  }
  .knowledge-flow-label {
    margin-top: 12px;
    font-size: 12px;
  }
}
</style>

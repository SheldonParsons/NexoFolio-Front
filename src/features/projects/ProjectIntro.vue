<script setup lang="ts">
const watermarkUrl = `url("${import.meta.env.BASE_URL}brand/nexofolio-icon.svg")`
</script>

<template>
  <aside class="project-intro" aria-labelledby="project-page-title">
    <div class="project-intro-copy">
      <p class="project-eyebrow"><span></span>YOUR WORKSPACE</p>
      <h1 id="project-page-title">
        项目<span>空间<span class="project-title-dot">.</span></span>
      </h1>
      <p class="project-intro-description">让每一次调用，<br />都有知识可循。</p>
      <div class="project-intro-caption"><span></span>选择项目，继续探索。</div>
    </div>
    <div class="project-intro-art" aria-hidden="true">
      <div
        class="project-intro-mark"
        :style="{ maskImage: watermarkUrl, WebkitMaskImage: watermarkUrl }"
      ></div>
      <span class="project-art-tick project-art-tick--top"></span>
      <span class="project-art-tick project-art-tick--bottom"></span>
    </div>
    <p class="project-intro-signature">KNOWLEDGE,<br /><span>CONNECTED.</span></p>
  </aside>
</template>

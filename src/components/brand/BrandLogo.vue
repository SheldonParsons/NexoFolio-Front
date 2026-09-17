<script setup lang="ts">
withDefaults(
  defineProps<{ variant?: 'horizontal' | 'icon' | 'stacked'; tone?: 'auto' | 'light' | 'dark' }>(),
  { variant: 'horizontal', tone: 'auto' },
)
const base = import.meta.env.BASE_URL
</script>
<template>
  <span
    class="brand-logo"
    :class="[`brand-logo--${variant}`, `brand-logo--${tone}`]"
    role="img"
    aria-label="NexoFolio"
  >
    <img
      v-if="variant === 'stacked'"
      class="brand-logo-stacked"
      :src="`${base}brand/nexofolio-wordmark.svg`"
      alt=""
      width="750"
      height="684"
    />
    <template v-else>
      <img
        class="brand-logo-icon"
        :src="`${base}brand/nexofolio-icon.svg`"
        alt=""
        width="522"
        height="483"
      />
      <img
        v-if="variant === 'horizontal'"
        class="brand-logo-text"
        :src="`${base}brand/nexofolio-text.svg`"
        alt=""
        width="750"
        height="154"
      />
    </template>
  </span>
</template>
<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
}
.brand-logo img {
  display: block;
  object-fit: contain;
}
.brand-logo-icon {
  width: 29px;
  height: auto;
}
.brand-logo-text {
  width: 123px;
  height: auto;
}
.brand-logo-stacked {
  width: 100%;
  height: auto;
}
.brand-logo--stacked {
  width: 110px;
}
.brand-logo--light img {
  filter: invert(1);
}
.brand-logo--auto img {
  filter: var(--brand-logo-filter, none);
}
</style>

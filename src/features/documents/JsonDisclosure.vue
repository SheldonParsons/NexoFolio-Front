<script setup lang="ts">
import { computed, ref } from 'vue'
const props = withDefaults(defineProps<{ value: unknown; label?: string }>(), {
  label: '查看 JSON',
})
const open = ref(false)
const text = computed(() => JSON.stringify(props.value, null, 2))
</script>
<template>
  <details class="document-json" @toggle="open = ($event.target as HTMLDetailsElement).open">
    <summary>{{ label }}</summary>
    <textarea v-if="open" :value="text" readonly spellcheck="false" :aria-label="label" />
  </details>
</template>

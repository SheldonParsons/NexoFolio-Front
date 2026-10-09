<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
const props = defineProps<{ to: RouteLocationRaw }>()
const router = useRouter(),
  status = ref('')
watch(
  () => props.to,
  () => {
    status.value = ''
  },
)
async function copy() {
  try {
    await navigator.clipboard.writeText(
      new URL(router.resolve(props.to).href, window.location.href).href,
    )
    status.value = '已复制链接'
  } catch {
    status.value = '复制失败，可从地址栏复制当前链接'
  }
}
</script>
<template>
  <span class="document-share"
    ><button type="button" class="document-secondary-button" @click="copy">复制链接</button
    ><span v-if="status" role="status">{{ status }}</span></span
  >
</template>

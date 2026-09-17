<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppIcon from '@/components/icons/AppIcon.vue'
withDefaults(defineProps<{ iconSize?: number }>(), { iconSize: 17 })
const auth = useAuthStore()
const router = useRouter()
</script>
<template>
  <button
    type="button"
    :disabled="auth.checking"
    :aria-busy="auth.checking"
    @click="router.push('/projects')"
  >
    {{ auth.checking ? '正在进入…' : '进入 NexoFolio'
    }}<AppIcon name="arrow-right" :size="iconSize" />
  </button>
</template>

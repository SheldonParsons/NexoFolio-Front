<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { navigation } from '@/app/navigation'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppIcon from '@/components/icons/AppIcon.vue'

const router = useRouter()
const open = ref(false)
const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
function focusSearch(event: Event) {
  event.preventDefault()
  searchInput.value?.focus()
}
const results = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  return navigation.filter((item) =>
    `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase().includes(value),
  )
})
watch(open, (value) => {
  if (!value) query.value = ''
})
function onShortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.isComposing) {
    event.preventDefault()
    open.value = !open.value
  }
}
function navigate(to: string) {
  open.value = false
  void router.push(to)
}
function onSearchKey(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter' && results.value[0]) {
    event.preventDefault()
    navigate(results.value[0].to)
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    document.querySelector<HTMLButtonElement>('.command-result')?.focus()
  }
}
function moveFocus(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
  event.preventDefault()
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.command-result'))
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onUnmounted(() => window.removeEventListener('keydown', onShortcut))
</script>

<template>
  <AppDialog
    v-model:open="open"
    title="快速导航"
    description="搜索页面，快速切换工作空间。"
    @open-auto-focus="focusSearch"
  >
    <template #trigger>
      <button class="search-trigger" type="button" aria-label="打开快速导航">
        <AppIcon name="search" :size="17" /><span>快速导航…</span><kbd>⌘ / Ctrl K</kbd>
      </button>
    </template>
    <div class="command-search">
      <AppIcon name="search" :size="20" />
      <input
        ref="searchInput"
        v-model="query"
        aria-label="搜索页面"
        placeholder="搜索项目、目录或设置…"
        autocomplete="off"
        @keydown="onSearchKey"
      />
    </div>
    <div class="command-results" aria-label="页面导航" @keydown="moveFocus">
      <button
        v-for="item in results"
        :key="item.to"
        class="command-result"
        type="button"
        @click="navigate(item.to)"
      >
        <AppIcon :name="item.icon" /><span
          ><strong>{{ item.label }}</strong
          ><small>{{ item.description }}</small></span
        ><AppIcon name="arrow-right" :size="16" />
      </button>
      <p v-if="results.length === 0" class="command-empty" role="status">
        没有找到相关页面，换个关键词试试。
      </p>
    </div>
    <div class="command-footer"><span>↑ ↓ 切换 · Enter 打开</span><span>Esc 关闭</span></div>
  </AppDialog>
</template>

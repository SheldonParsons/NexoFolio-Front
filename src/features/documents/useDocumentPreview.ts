import { inject, onMounted, onScopeDispose, provide, ref, type InjectionKey } from 'vue'
export function previewCoordinator() {
  const active = ref<symbol | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  function close() {
    clearTimeout(timer)
    active.value = null
  }
  function enter(id: symbol) {
    clearTimeout(timer)
    active.value = id
  }
  function leave(id: symbol) {
    if (active.value !== id) return
    clearTimeout(timer)
    timer = setTimeout(close, 180)
  }
  function cancel(id: symbol) {
    if (active.value === id) close()
  }
  return { active, close, enter, leave, keep: enter, cancel }
}
const key: InjectionKey<ReturnType<typeof previewCoordinator>> = Symbol('document-preview')
export function provideDocumentPreview() {
  const preview = previewCoordinator()
  provide(key, preview)
  const onScroll = (event: Event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.document-preview'))
      preview.close()
  }
  onMounted(() => {
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', preview.close)
  })
  onScopeDispose(() => {
    preview.close()
    window.removeEventListener('scroll', onScroll, true)
    window.removeEventListener('resize', preview.close)
  })
  return preview
}
export function useDocumentPreview() {
  const preview = inject(key)
  if (!preview) throw new Error('Document previews require a workspace provider')
  return preview
}

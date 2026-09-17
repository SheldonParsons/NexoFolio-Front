import { onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
export function useCopyLink() {
  const router = useRouter()
  const copied = ref('')
  const error = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  async function copy(path: string) {
    clearTimeout(timer)
    error.value = ''
    copied.value = ''
    try {
      await navigator.clipboard.writeText(
        new URL(router.resolve(path).href, window.location.origin).href,
      )
      copied.value = path
      timer = setTimeout(() => {
        copied.value = ''
      }, 1800)
    } catch {
      error.value = '暂时无法复制，请复制浏览器地址栏中的链接。'
    }
  }
  onScopeDispose(() => clearTimeout(timer))
  return { copy, copied, error }
}

import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Codex's answer to long names: truncate with a faded tail, then on hover scroll
 * the text back to its end at a constant speed instead of wrapping it. The
 * distance decides the duration, so a slightly long path crawls and a very long
 * one does not take a minute.
 */
const SPEED_PX_PER_SECOND = 44
const MIN_DURATION_MS = 420

export function useMarqueeOverflow(element: Ref<HTMLElement | undefined>, text: Ref<string>) {
  const overflowing = ref(false)
  const distance = ref(0)
  let observer: ResizeObserver | undefined

  function measure() {
    const node = element.value
    if (!node) {
      overflowing.value = false
      return
    }
    const slack = node.scrollWidth - node.clientWidth
    overflowing.value = slack > 1
    distance.value = Math.max(0, slack)
  }

  onMounted(() => {
    measure()
    observer = new ResizeObserver(measure)
    if (element.value) observer.observe(element.value)
  })
  watch(text, () => requestAnimationFrame(measure))
  onBeforeUnmount(() => observer?.disconnect())

  const style = () => ({
    '--marquee-shift': `${-distance.value}px`,
    '--marquee-duration': `${Math.max(MIN_DURATION_MS, (distance.value / SPEED_PX_PER_SECOND) * 1000).toFixed(0)}ms`,
  })

  return { overflowing, distance, style, measure }
}

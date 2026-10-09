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
const LOOP_GAP_PX = 32

export function useMarqueeOverflow(
  element: Ref<HTMLElement | undefined>,
  text: Ref<string>,
  endInset = 0,
) {
  const overflowing = ref(false)
  const distance = ref(0)
  const textWidth = ref(0)
  let observer: ResizeObserver | undefined

  const contentFor = (node: HTMLElement) =>
    node.querySelector<HTMLElement>('[data-marquee-text]') ??
    (node.firstElementChild as HTMLElement | null)

  function measure() {
    const node = element.value
    if (!node) {
      overflowing.value = false
      distance.value = 0
      textWidth.value = 0
      return
    }
    // Measure the text itself so a running transform does not change its width.
    const content = contentFor(node)
    textWidth.value = content?.getBoundingClientRect().width ?? node.scrollWidth
    const slack = textWidth.value - node.clientWidth
    overflowing.value = slack > 1
    distance.value = Math.max(0, slack)
  }

  onMounted(() => {
    measure()
    observer = new ResizeObserver(measure)
    if (element.value) observe(element.value)
  })
  function observe(node: HTMLElement) {
    observer?.observe(node)
    const content = contentFor(node)
    if (content) observer?.observe(content)
  }
  function unobserve(node: HTMLElement) {
    observer?.unobserve(node)
    const content = contentFor(node)
    if (content) observer?.unobserve(content)
  }
  watch(text, measure, { flush: 'post' })
  watch(
    element,
    (node, previous) => {
      if (previous) unobserve(previous)
      if (node) observe(node)
      measure()
    },
    { flush: 'post' },
  )
  onBeforeUnmount(() => observer?.disconnect())

  const style = () => {
    // Leave the final characters clear of the faded edge when scrolling ends.
    const travel = distance.value + (overflowing.value ? endInset : 0)
    const loopTravel = textWidth.value + LOOP_GAP_PX
    return {
      '--marquee-shift': `${-travel}px`,
      '--marquee-duration': `${Math.max(MIN_DURATION_MS, (travel / SPEED_PX_PER_SECOND) * 1000).toFixed(0)}ms`,
      '--marquee-loop-gap': `${LOOP_GAP_PX}px`,
      '--marquee-loop-shift': `${-loopTravel}px`,
      '--marquee-loop-duration': `${Math.max(MIN_DURATION_MS, (loopTravel / SPEED_PX_PER_SECOND) * 1000).toFixed(0)}ms`,
    }
  }

  return { overflowing, distance, style, measure }
}

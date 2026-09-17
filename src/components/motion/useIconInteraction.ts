import { computed, ref } from 'vue'

/** Bind to the whole control, so its icon responds to pointer and keyboard intent. */
export function useIconInteraction() {
  const pointer = ref(false)
  const keyboard = ref(false)
  const events = {
    pointerenter: () => {
      pointer.value = true
    },
    pointerleave: () => {
      pointer.value = false
    },
    pointerdown: () => {
      keyboard.value = false
    },
    focusin: (event: FocusEvent) => {
      keyboard.value = (event.target as HTMLElement | null)?.matches(':focus-visible') ?? false
    },
    focusout: (event: FocusEvent) => {
      if (
        !(event.currentTarget as HTMLElement | null)?.contains(event.relatedTarget as Node | null)
      )
        keyboard.value = false
    },
    keydown: () => {
      keyboard.value = true
    },
  }
  return { active: computed(() => pointer.value || keyboard.value), events }
}

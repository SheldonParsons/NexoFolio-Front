import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  CURATION_PANEL_SIZE_KEY,
  readPanelSize,
  writePanelSize,
  type CurationPanelSize,
} from './panelSize'

// Shared across route mounts; localStorage also restores the choice after a reload.
const remembered = ref<CurationPanelSize>(readPanelSize())

export function usePanelSize(
  historicalOnly: () => boolean = () => false,
  initialSize?: CurationPanelSize,
) {
  const initial = ref<CurationPanelSize | null>(initialSize ?? null)
  const historicalSize = ref<CurationPanelSize>('mini')
  const size = computed(
    () => initial.value ?? (historicalOnly() ? historicalSize.value : remembered.value),
  )
  watch(historicalOnly, (historical) => {
    if (historical) historicalSize.value = 'mini'
  })
  function setSize(value: CurationPanelSize) {
    initial.value = null
    if (historicalOnly()) historicalSize.value = value
    else {
      remembered.value = value
      writePanelSize(value)
    }
  }
  function onStorage(event: StorageEvent) {
    if (event.key === CURATION_PANEL_SIZE_KEY || event.key === null)
      remembered.value = readPanelSize()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    onScopeDispose(() => window.removeEventListener('storage', onStorage))
  }
  return { size, setSize }
}

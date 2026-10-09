export type CurationPanelSize = 'full' | 'compact' | 'mini'
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export const CURATION_PANEL_SIZE_KEY = 'nexofolio.curation-panel.size.v1'

export function readPanelSize(storage?: StoragePort): CurationPanelSize {
  try {
    const value = (storage ?? localStorage).getItem(CURATION_PANEL_SIZE_KEY)
    return value === 'compact' || value === 'mini' ? value : 'full'
  } catch {
    return 'full'
  }
}

export function writePanelSize(size: CurationPanelSize, storage?: StoragePort): void {
  try {
    ;(storage ?? localStorage).setItem(CURATION_PANEL_SIZE_KEY, size)
  } catch {
    // Display preferences must never prevent a curation action.
  }
}

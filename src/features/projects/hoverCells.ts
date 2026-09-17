// Mirrors AsyncTest-Wx's claim-ignite / claim-flicker timing in monochrome.
// Stable jitter keeps ordinary Vue updates from changing each cell's phase.
export const HOVER_CELL_SIZE = 14
export const HOVER_CELL_GAP = 3
export const HOVER_FILL_RATIO = 0.7

export function createHoverCells(columns: number, rows: number) {
  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const progress = columns > 1 ? column / (columns - 1) : 0
    const jitter = ((row * 73 + column * 37 + 17) % 101) / 100
    const edge = Math.max(0, 1 - progress / 0.14, 1 - (1 - progress) / 0.14)
    return {
      id: `${row}-${column}`,
      style: {
        '--cell-delay': `${(progress * 0.85 + jitter * 0.17).toFixed(3)}s`,
        '--cell-min-opacity': (0.88 - progress * 0.6).toFixed(2),
        '--cell-edge-blur': `${(edge * 1.6).toFixed(2)}px`,
      },
    }
  })
}

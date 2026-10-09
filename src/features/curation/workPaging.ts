/** Reserve the remaining height for the activity feed instead of stacking all workers. */
export function workPageSize(availableHeight: number): 0 | 2 | 4 {
  if (availableHeight >= 400) return 4
  if (availableHeight >= 300) return 2
  return 0
}

export function workPage<T>(items: readonly T[], requestedPage: number, size: number) {
  const pageSize = Math.max(1, size)
  const pages = Math.max(1, Math.ceil(items.length / pageSize))
  const index = Math.min(pages - 1, Math.max(0, requestedPage))
  const start = index * pageSize
  return {
    index,
    pages,
    start: items.length ? start + 1 : 0,
    end: Math.min(items.length, start + pageSize),
    items: items.slice(start, start + pageSize),
    rows: Math.ceil(Math.min(items.length, pageSize) / 2),
  }
}

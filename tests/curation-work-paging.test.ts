import { expect, it } from 'vitest'
import { workPage, workPageSize } from '@/features/curation/workPaging'

it('keeps eight workers reachable without adding rows to the fixed preview', () => {
  const workers = Array.from({ length: 8 }, (_, id) => ({ id }))
  for (const size of [2, 4]) {
    const first = workPage(workers, 0, size)
    const pages = Array.from({ length: first.pages }, (_, i) => workPage(workers, i, size))
    expect(pages.flatMap((page) => page.items)).toEqual(workers)
    expect(pages.every((page) => page.items.length <= size && page.rows <= 2)).toBe(true)
  }
  expect(workers.map((worker) => worker.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
})

it('keeps the last partial page the same height and clamps pages when workers finish', () => {
  const workers = [0, 1, 2, 3, 4]
  expect(workPage(workers, 1, 4)).toMatchObject({ rows: 2, start: 5, end: 5, items: [4] })
  expect(workPage(workers.slice(0, 3), 1, 4)).toMatchObject({
    index: 0,
    pages: 1,
    items: [0, 1, 2],
  })
  expect(workPage([], 2, 4)).toMatchObject({
    index: 0,
    pages: 1,
    start: 0,
    end: 0,
    rows: 0,
    items: [],
  })
})

it('reserves activity space by reducing or collapsing task previews in short panels', () => {
  expect(workPageSize(440)).toBe(4)
  expect(workPageSize(350)).toBe(2)
  expect(workPageSize(220)).toBe(0)
  expect(workPageSize(0)).toBe(0)
})

import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useDocumentSamples } from '@/features/documents/useDocumentSamples'
import * as source from '@/features/documents/source'
afterEach(() => vi.restoreAllMocks())
function fixture() {
  const project = ref('p'),
    endpoint = ref('e'),
    env = ref('test')
  const scope = effectScope()
  const value = scope.run(() =>
    useDocumentSamples(
      () => project.value,
      () => endpoint.value,
      () => env.value,
      (cause, target) => (target.value = String(cause)),
    ),
  )!
  return { scope, value, env }
}
it('keeps displayed content during another read and reuses a captured sample without refetching', async () => {
  const read = vi.spyOn(source, 'example').mockResolvedValue({ observation: { id: 'a' } })
  const { scope, value } = fixture()
  try {
    await value.selectExample('a')
    let finish!: (value: { observation: unknown }) => void
    read.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    const waiting = value.selectExample('b')
    expect(value.sample.value).toEqual({ id: 'a' })
    expect(value.displayedSampleId.value).toBe('a')
    finish({ observation: { id: 'b' } })
    await waiting
    await value.selectExample('a')
    expect(read).toHaveBeenCalledTimes(2)
    expect(value.sample.value).toEqual({ id: 'a' })
  } finally {
    scope.stop()
  }
})
it('deduplicates parallel reads for comparison and preview and rejects late old-scope data', async () => {
  let finish!: (value: { observation: unknown }) => void
  const read = vi
    .spyOn(source, 'example')
    .mockImplementation(() => new Promise((resolve) => (finish = resolve)))
  const { scope, value, env } = fixture()
  try {
    const compare = value.toggleComparison('a'),
      preview = value.selectExample('a')
    expect(read).toHaveBeenCalledTimes(1)
    env.value = 'prod'
    value.resetSamples()
    finish({ observation: { old: 'should not display' } })
    await Promise.all([compare, preview])
    expect(value.sample.value).toBeNull()
    expect(value.samplePayloads.value.size).toBe(0)
    expect(value.comparisonIds.value).toEqual([])
  } finally {
    scope.stop()
  }
})
it('limits comparison to four samples and updates the baseline when its sample is removed', async () => {
  vi.spyOn(source, 'example').mockResolvedValue({ observation: { data: 1 } })
  const { scope, value } = fixture()
  try {
    for (const id of ['a', 'b', 'c', 'd', 'e']) await value.toggleComparison(id)
    expect(value.comparisonIds.value).toEqual(['a', 'b', 'c', 'd'])
    expect(value.comparisonReady.value).toBe(true)
    await value.toggleComparison('a')
    expect(value.baselineId.value).toBe('b')
  } finally {
    scope.stop()
  }
})

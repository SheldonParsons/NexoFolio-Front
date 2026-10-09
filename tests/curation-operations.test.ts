import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useCandidateOperations } from '@/features/curation/useCandidateOperations'
import { actorLabel, operationNote } from '@/features/curation/operationPresentation'
import * as source from '@/features/curation/source'
import type { CandidateOperations } from '@/features/curation/types'
vi.mock('@/features/curation/source', () => ({ candidateOperations: vi.fn() }))
const scopes: ReturnType<typeof effectScope>[] = []
const result: CandidateOperations = {
  names_unavailable: false,
  events: [
    {
      id: 'e',
      action: 'organize',
      actor: { kind: 'user', id: 'u', display_name: '发起人' },
      at: '2026-10-08T00:00:00Z',
      source: 'recorded',
    },
  ],
}
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.resetAllMocks()
})
function fixture() {
  const pid = ref('p'),
    cid = ref('c'),
    open = ref(false),
    scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() =>
    useCandidateOperations(
      () => pid.value,
      () => cid.value,
      () => open.value,
      vi.fn(),
    ),
  )!
  return { pid, cid, open, state, scope }
}
it('reads history only when requested, with the exact candidate identity', async () => {
  vi.mocked(source.candidateOperations).mockResolvedValue(result)
  const f = fixture()
  expect(source.candidateOperations).not.toHaveBeenCalled()
  f.open.value = true
  await nextTick()
  await Promise.resolve()
  expect(source.candidateOperations).toHaveBeenCalledWith('p', 'c', expect.any(AbortSignal))
  expect(f.state.events.value[0]?.actor.kind).toBe('user')
})
it('cancels a closed panel and ignores a delayed reply', async () => {
  let finish!: (r: CandidateOperations) => void
  vi.mocked(source.candidateOperations).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r
      }),
  )
  const f = fixture()
  f.open.value = true
  await nextTick()
  const signal = vi.mocked(source.candidateOperations).mock.calls[0]![2]!
  f.open.value = false
  await nextTick()
  finish(result)
  await Promise.resolve()
  expect(signal.aborted).toBe(true)
  expect(f.state.events.value).toEqual([])
})
it('does not attribute missing historical identity to the current user or system', () => {
  expect(actorLabel({ kind: 'unknown' })).toBe('操作者未记录')
  expect(actorLabel({ kind: 'system', id: 'system', display_name: '系统' })).toBe('系统')
  expect(
    operationNote({ ...result.events[0]!, actor: { kind: 'unknown' }, source: 'legacy' }),
  ).toContain('旧记录')
  expect(operationNote({ ...result.events[0]!, actor: { kind: 'unknown' } })).not.toContain(
    '旧记录',
  )
})

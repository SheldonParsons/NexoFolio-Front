import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '../src/api/client'
import { useProjectEntry } from '../src/features/projects/useProjectEntry'
import { useNavigationTransition } from '../src/stores/navigationTransition'
import { readVisits, recordVisit } from '../src/features/projects/recent'
import type { Project } from '../src/features/projects/types'
const { push, auth, clearCredential } = vi.hoisted(() => ({
  push: vi.fn(),
  auth: { user: {} as unknown, requestLogin: vi.fn() },
  clearCredential: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('@/api/session', () => ({ clearCredential }))
const item: Project = {
  project_id: 'one',
  name: '项目一',
  status: 'doing',
  can_access: true,
  access_state: 'allowed',
  reason_code: null,
}
const scopes: ReturnType<typeof effectScope>[] = []
function setup(get = vi.fn().mockResolvedValue(item)) {
  const scope = effectScope()
  scopes.push(scope)
  return {
    scope,
    get,
    entry: scope.run(() => useProjectEntry({ get, list: vi.fn() }, 'api:mock:user'))!,
    transition: useNavigationTransition(),
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  push.mockResolvedValue(undefined)
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key),
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.unstubAllGlobals()
})
describe('project admission and navigation lifecycle', () => {
  it('guards duplicate requests and records only after navigation succeeds', async () => {
    let accept!: (project: Project) => void
    const get = vi.fn(
      (_id: string, _signal: AbortSignal) =>
        new Promise<Project>((resolve) => {
          accept = resolve
        }),
    )
    const { entry, transition } = setup(get)
    const first = entry.open(item)
    await entry.open(item)
    expect(get).toHaveBeenCalledTimes(1)
    expect(entry.openingId.value).toBe('one')
    expect(readVisits('api:mock:user')).toEqual([])
    expect(transition.current).toBeNull()
    accept(item)
    await first
    expect(push).toHaveBeenCalledWith('/projects/one/catalog')
    expect(transition.current).toMatchObject({ durationMs: 2000, pending: false })
    expect(readVisits('api:mock:user')[0]?.id).toBe('one')
  })
  it.each([403, 404, 503])(
    'shows a local explanation for %i without a success overlay',
    async (status) => {
      const { entry, transition } = setup(
        vi.fn().mockRejectedValue(new ApiError('unavailable', 'http', status)),
      )
      await entry.open(item)
      expect(entry.dialogOpen.value).toBe(true)
      expect(entry.openingId.value).toBeNull()
      expect(transition.current).toBeNull()
      expect(push).not.toHaveBeenCalled()
      expect(readVisits('api:mock:user')).toEqual([])
    },
  )
  it('aborts pending admission on unmount, ignoring even a late successful response', async () => {
    let accept!: (project: Project) => void
    const get = vi.fn(
      (_id: string, _signal: AbortSignal) =>
        new Promise<Project>((resolve) => {
          accept = resolve
        }),
    )
    const { scope, entry, transition } = setup(get)
    const pending = entry.open(item)
    const signal = get.mock.calls[0]![1] as AbortSignal
    scope.stop()
    expect(signal.aborted).toBe(true)
    accept(item)
    await pending
    expect(push).not.toHaveBeenCalled()
    expect(transition.current).toBeNull()
    expect(readVisits('api:mock:user')).toEqual([])
  })
  it('keeps the global overlay alive while the source page unmounts on successful navigation', async () => {
    const { scope, entry, transition } = setup()
    push.mockImplementation(async () => {
      scope.stop()
      return undefined
    })
    await entry.open(item)
    expect(transition.current).toMatchObject({ durationMs: 2000, pending: false })
    expect(readVisits('api:mock:user')).toHaveLength(1)
  })
  it('cleans up failed navigation and rejects callbacks from a replaced transition', async () => {
    const { entry, transition } = setup()
    push.mockResolvedValue({ type: 4 })
    await entry.open(item)
    expect(transition.current).toBeNull()
    expect(readVisits('api:mock:user')).toEqual([])
    const old = transition.start('old', 2000)
    const next = transition.start('new', 2000)
    transition.finish(old)
    transition.settle(old)
    expect(transition.current).toMatchObject({ runId: next, pending: true })
    transition.finish(next)
    expect(transition.current).toBeNull()
  })
  it('returns expired sessions to login instead of claiming a permissions error', async () => {
    const { entry, transition } = setup(
      vi.fn().mockRejectedValue(new ApiError('expired', 'http', 401)),
    )
    await entry.open(item)
    expect(clearCredential).toHaveBeenCalled()
    expect(auth.requestLogin).toHaveBeenCalledWith('/projects', expect.any(String))
    expect(push).toHaveBeenCalledWith('/')
    expect(entry.dialogOpen.value).toBe(false)
    expect(transition.current).toBeNull()
  })
  it('evicts an existing recent visit immediately when fresh admission returns 403', async () => {
    recordVisit('api:mock:user', item.project_id)
    const { entry } = setup(vi.fn().mockRejectedValue(new ApiError('revoked', 'http', 403)))
    await entry.open(item)
    expect(readVisits('api:mock:user')).toEqual([])
  })
})

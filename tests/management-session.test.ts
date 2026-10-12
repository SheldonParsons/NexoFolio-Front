import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
const state = vi.hoisted(() => ({ token: 'admin' as string | undefined, current: vi.fn() }))
vi.mock('../src/api/auth', async (original) => ({
  ...(await original<object>()),
  getCurrentUser: state.current,
}))
vi.mock('../src/api/session', () => ({
  readCredential: () => (state.token ? { token: state.token } : null),
  clearCredential: () => {
    state.token = undefined
  },
}))
import { useAuthStore } from '../src/stores/auth'
import { listManagementProjects } from '../src/features/management/projects'
const user = {
  id: 'admin',
  account: 'A80646',
  display_name: 'fixture',
  enabled: true,
  can_manage_projects: true,
}
beforeEach(() => {
  setActivePinia(createPinia())
  state.token = 'admin'
  state.current.mockReset()
})
describe('management identity races', () => {
  it('does not restore the old identity when a pending session check finishes after sign out', async () => {
    let resolve!: (value: typeof user) => void
    state.current.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const auth = useAuthStore()
    auth.user = user
    const pending = auth.checkSession()
    auth.signOut()
    resolve(user)
    await pending
    expect(auth.user).toBeNull()
    expect(auth.canManageProjects).toBe(false)
  })
  it('rejects a stale response while a different account is being verified', async () => {
    let old!: (value: typeof user) => void
    state.current
      .mockReturnValueOnce(
        new Promise((r) => {
          old = r
        }),
      )
      .mockResolvedValueOnce({
        ...user,
        id: 'member',
        account: 'member',
        can_manage_projects: false,
      })
    const auth = useAuthStore()
    const first = auth.checkSession()
    state.token = 'member'
    auth.forgetSession()
    await auth.checkSession()
    old(user)
    await first
    expect(auth.user?.account).toBe('member')
    expect(auth.canManageProjects).toBe(false)
  })
  it('fails closed for management when server validation fails', async () => {
    const auth = useAuthStore()
    auth.user = user
    state.current.mockRejectedValue(new Error('offline'))
    await expect(auth.checkSession()).rejects.toThrow('offline')
    expect(auth.canManageProjects).toBe(false)
  })
})
describe('management pagination contract', () => {
  it('sends filters to the server and preserves the server total, rejecting inconsistent pagination', async () => {
    const request = vi.fn().mockResolvedValue({ items: [], page: 2, limit: 20, total: 40 }),
      signal = new AbortController().signal
    const result = await listManagementProjects(
      { page: 2, limit: 20, q: ' 巴西 ', origin: 'local' },
      signal,
      request,
    )
    expect(result.total).toBe(40)
    const query = new URL(request.mock.calls[0]![0], 'http://fixture').searchParams
    expect(query.get('q')).toBe('巴西')
    expect(query.get('origin')).toBe('local')
    expect(query.get('page')).toBe('2')
    request.mockResolvedValue({ items: [], page: 1, limit: 20, total: 40 })
    await expect(
      listManagementProjects({ page: 2, limit: 20 }, signal, request),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})

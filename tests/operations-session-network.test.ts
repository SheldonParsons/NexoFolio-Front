import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { effectScope, reactive } from 'vue'
import { useSessionLifecycle } from '@/features/auth/useSessionLifecycle'
const { mounted, credential, checks } = vi.hoisted(() => ({
  mounted: [] as (() => void)[],
  credential: {
    value: { token: 'a', expiresAt: '2099-01-01T00:00:00Z' } as {
      token: string
      expiresAt: string
    } | null,
  },
  checks: vi.fn(),
}))
vi.mock('vue', async (original) => ({
  ...(await original<typeof import('vue')>()),
  onMounted: (fn: () => void) => mounted.push(fn),
}))
vi.mock('@/api/session', () => ({ readCredential: () => credential.value }))
const auth = reactive({
  user: { id: 'admin' } as { id: string } | null,
  canManageProjects: true,
  checkSession: checks,
  forgetSession: vi.fn(() => {
    auth.user = null
  }),
  revokeManagement: vi.fn(),
})
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
let scope: ReturnType<typeof effectScope>,
  win: EventTarget,
  doc: EventTarget & { visibilityState: string },
  network: { onLine: boolean }
beforeEach(() => {
  vi.useFakeTimers()
  mounted.length = 0
  auth.user = { id: 'admin' }
  credential.value = { token: 'a', expiresAt: '2099-01-01T00:00:00Z' }
  checks.mockResolvedValue(true)
  win = new EventTarget()
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  network = { onLine: false }
  vi.stubGlobal('window', win)
  vi.stubGlobal('document', doc)
  vi.stubGlobal('navigator', network)
  scope = effectScope()
  scope.run(useSessionLifecycle)
  mounted.forEach((fn) => fn())
})
afterEach(() => {
  scope.stop()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.useRealTimers()
})
it('does not turn an offline focus or timer into permission loss and revalidates online', async () => {
  win.dispatchEvent(new Event('focus'))
  await vi.advanceTimersByTimeAsync(30000)
  expect(checks).not.toHaveBeenCalled()
  expect(auth.user?.id).toBe('admin')
  expect(auth.revokeManagement).not.toHaveBeenCalled()
  network.onLine = true
  win.dispatchEvent(new Event('online'))
  await Promise.resolve()
  expect(checks).toHaveBeenCalledTimes(1)
})
it('still forgets an expired or removed credential while offline', () => {
  credential.value = null
  win.dispatchEvent(new Event('focus'))
  expect(auth.forgetSession).toHaveBeenCalledTimes(1)
  expect(auth.user).toBeNull()
  expect(checks).not.toHaveBeenCalled()
})
it('still fails closed on a failed server revalidation when the network is available', async () => {
  network.onLine = true
  checks.mockRejectedValueOnce(new Error('unavailable'))
  win.dispatchEvent(new Event('online'))
  await Promise.resolve()
  await Promise.resolve()
  expect(auth.revokeManagement).toHaveBeenCalledTimes(1)
})

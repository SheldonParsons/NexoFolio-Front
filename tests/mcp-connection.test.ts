import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { mcpServiceUrl } from '@/features/mcp-credentials/connection'
import { useMcpConnection } from '@/features/mcp-credentials/useMcpConnection'
import * as source from '@/features/mcp-credentials/source'

const scopes: ReturnType<typeof effectScope>[] = []
const info = (count: number | null): source.McpConnection => ({
  transport: 'Streamable HTTP',
  protocol_versions: ['2025-11-25'],
  accessible_projects: count,
})
const user = (id: string) => ({ id, account: id, display_name: id, enabled: true })
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  scopes.splice(0).forEach((s) => s.stop())
  vi.restoreAllMocks()
})
function fixture() {
  const auth = useAuthStore()
  auth.user = user('alice')
  const scope = effectScope()
  scopes.push(scope)
  return { auth, state: scope.run(useMcpConnection)! }
}
it('uses the API proxy prefix for local, subpath and separately hosted deployments', () => {
  expect(mcpServiceUrl('/api', 'http://localhost:5173/settings/mcp')).toBe(
    'http://localhost:5173/api/mcp',
  )
  expect(mcpServiceUrl('/nexofolio/api/', 'https://example.com/settings/mcp')).toBe(
    'https://example.com/nexofolio/api/mcp',
  )
  expect(mcpServiceUrl('https://api.example.com/', 'https://example.com/settings/mcp')).toBe(
    'https://api.example.com/mcp',
  )
  for (const base of [
    'https://user:password@example.com',
    '/api?token=fixture',
    '/api#fragment',
    'javascript:alert(1)',
    'https://',
  ]) {
    expect(mcpServiceUrl(base, 'https://example.com')).toBe('')
  }
})
it('distinguishes zero grants from an unknown permission snapshot', async () => {
  const read = vi.spyOn(source, 'readMcpConnection').mockResolvedValue(info(0))
  const { state } = fixture()
  await vi.waitFor(() => expect(state.info.value?.accessible_projects).toBe(0))
  read.mockResolvedValue(info(null))
  await state.load()
  expect(state.info.value?.accessible_projects).toBeNull()
})
it('discards a previous account response and clears the old count immediately', async () => {
  let finish!: (value: source.McpConnection) => void
  vi.spyOn(source, 'readMcpConnection')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue(info(3))
  const { auth, state } = fixture()
  auth.user = user('bob')
  expect(state.info.value).toBeNull()
  await vi.waitFor(() => expect(state.info.value?.accessible_projects).toBe(3))
  finish(info(20))
  await Promise.resolve()
  expect(state.info.value?.accessible_projects).toBe(3)
})
it('does not retain a stale count or replace a failed request with zero', async () => {
  const read = vi.spyOn(source, 'readMcpConnection').mockResolvedValue(info(20))
  const { state } = fixture()
  await vi.waitFor(() => expect(state.info.value?.accessible_projects).toBe(20))
  read.mockRejectedValue(new Error('offline'))
  await state.load()
  expect(state.info.value).toBeNull()
  expect(state.error.value).toContain('重试')
})

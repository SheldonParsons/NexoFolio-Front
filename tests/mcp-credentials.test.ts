import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useMcpCredentials } from '@/features/mcp-credentials/useMcpCredentials'
import { credentialInput, localDateTime } from '@/features/mcp-credentials/model'
import * as source from '@/features/mcp-credentials/source'

const item = (id = 'credential-a'): source.McpCredential => ({
  id,
  name: '客户端',
  issued_at: '2026-10-09T00:00:00Z',
  starts_at: '2026-10-09T00:00:00Z',
  expires_at: null,
  revoked_at: null,
  status: 'active',
})
const page = (items: source.McpCredential[] = []): source.CredentialPage => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
})
const issued = (): source.CreatedCredential => ({
  credential: item(),
  token: 'fixture-only-mcp-token',
  token_type: 'Bearer',
})
const user = (id: string) => ({ id, account: id, display_name: id, enabled: true })
const input = { name: '客户端', starts_at: null, expires_at: null }
const scopes: ReturnType<typeof effectScope>[] = []
beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.restoreAllMocks()
})
function fixture() {
  const auth = useAuthStore()
  auth.user = user('alice')
  const scope = effectScope()
  scopes.push(scope)
  return { auth, scope, state: scope.run(useMcpCredentials)! }
}
it('converts device-local ranges to timezone-qualified instants and ignores dates for unlimited tokens', () => {
  const start = new Date(2030, 4, 2, 9, 30),
    end = new Date(2030, 4, 3, 18, 45)
  const draft = {
    name: ' 开发客户端 ',
    validity: 'range' as const,
    startsAt: localDateTime(start),
    expiresAt: localDateTime(end),
  }
  expect(credentialInput(draft, start.getTime())).toEqual({
    name: '开发客户端',
    starts_at: start.toISOString(),
    expires_at: end.toISOString(),
  })
  expect(
    credentialInput({ ...draft, validity: 'unlimited', startsAt: 'invalid', expiresAt: 'invalid' }),
  ).toEqual({ name: '开发客户端', starts_at: null, expires_at: null })
  expect(() => credentialInput({ ...draft, expiresAt: draft.startsAt }, start.getTime())).toThrow(
    '结束时间',
  )
  expect(() => credentialInput(draft, end.getTime())).toThrow('当前时间')
  expect(() =>
    credentialInput({ ...draft, startsAt: '2030-02-30T09:00' }, start.getTime()),
  ).toThrow()
  expect(() => credentialInput({ ...draft, name: ' ' })).toThrow('名称')
  expect(() => credentialInput({ ...draft, name: '字'.repeat(65) })).toThrow('名称')
})
it('discards a delayed old-account list even when the request ignores cancellation', async () => {
  let old!: (value: source.CredentialPage) => void
  vi.spyOn(source, 'readCredentials')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          old = resolve
        }),
    )
    .mockResolvedValue(page([item('bob-only')]))
  const { auth, state } = fixture()
  auth.user = user('bob')
  await vi.waitFor(() => expect(state.listing.value?.items[0]?.id).toBe('bob-only'))
  old(page([item('alice-only')]))
  await Promise.resolve()
  expect(state.listing.value?.items[0]?.id).toBe('bob-only')
})
it('clears a created secret on account switch and page disposal', async () => {
  vi.spyOn(source, 'readCredentials').mockResolvedValue(page())
  vi.spyOn(source, 'createCredential').mockResolvedValue(issued())
  const { auth, scope, state } = fixture()
  expect(await state.create(input)).toBe(true)
  expect(state.created.value).not.toBeNull()
  auth.user = user('bob')
  expect(state.created.value).toBeNull()
  expect(await state.create(input)).toBe(true)
  scope.stop()
  expect(state.created.value).toBeNull()
  expect(state.listing.value).toBeNull()
})
it('never exposes a late creation response after the owner changed', async () => {
  vi.spyOn(source, 'readCredentials').mockResolvedValue(page())
  let finish!: (value: source.CreatedCredential) => void
  vi.spyOn(source, 'createCredential').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { auth, state } = fixture()
  const pending = state.create(input)
  auth.user = user('bob')
  finish(issued())
  expect(await pending).toBe(false)
  expect(state.created.value).toBeNull()
})
it('reconciles uncertain creation without retrying or claiming a recovered secret', async () => {
  const read = vi.spyOn(source, 'readCredentials').mockResolvedValue(page([item()]))
  const create = vi
    .spyOn(source, 'createCredential')
    .mockRejectedValue(new ApiError('timeout', 'timeout'))
  const { state } = fixture()
  expect(await state.create(input)).toBe(false)
  expect(create).toHaveBeenCalledTimes(1)
  expect(read).toHaveBeenCalledTimes(2)
  expect(state.created.value).toBeNull()
  expect(state.listing.value?.total).toBe(1)
  expect(state.createError.value).toContain('先撤销')
})
it('blocks duplicate create requests while one is pending', async () => {
  vi.spyOn(source, 'readCredentials').mockResolvedValue(page())
  let finish!: (value: source.CreatedCredential) => void
  const create = vi.spyOn(source, 'createCredential').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const { state } = fixture()
  const first = state.create(input)
  expect(await state.create(input)).toBe(false)
  finish(issued())
  expect(await first).toBe(true)
  expect(create).toHaveBeenCalledTimes(1)
})
it('recognizes a completed revoke after a lost response and refreshes its status', async () => {
  vi.spyOn(source, 'readCredentials').mockResolvedValue(
    page([{ ...item(), status: 'revoked', revoked_at: '2026-10-10T00:00:00Z' }]),
  )
  const revoke = vi
    .spyOn(source, 'revokeCredential')
    .mockRejectedValue(new ApiError('network', 'network'))
  const { state } = fixture()
  expect(await state.revoke('credential-a')).toBe(true)
  expect(revoke).toHaveBeenCalledTimes(1)
  expect(state.listing.value?.items[0]?.status).toBe('revoked')
})

it('retains a confirmed revocation even when the following list refresh fails', async () => {
  const read = vi.spyOn(source, 'readCredentials').mockResolvedValue(page([item()]))
  vi.spyOn(source, 'revokeCredential').mockResolvedValue(undefined)
  const { state } = fixture()
  await vi.waitFor(() => expect(state.listing.value?.total).toBe(1))
  read.mockRejectedValue(new ApiError('暂时无法连接服务', 'network'))
  expect(await state.revoke('credential-a')).toBe(true)
  expect(state.listing.value?.items[0]?.status).toBe('revoked')
  expect(state.loadError.value).toContain('暂时无法连接服务')
})
